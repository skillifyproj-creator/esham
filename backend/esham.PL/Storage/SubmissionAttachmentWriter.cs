using System.Collections.Concurrent;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using esham.BLL.DTOs.Submissions;
using esham.BLL.Interfaces;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.PL.Storage;

public sealed class SubmissionAttachmentWriter(AppDbContext db, ISubmissionMutationGate gate, string root) : ISubmissionAttachmentWriter, IDisposable
{
    public const long MaximumBytes = 10 * 1024 * 1024;
    private readonly string directory = Path.GetFullPath(root);
    private readonly ConcurrentDictionary<string, FileStream> leases = new();
    private string Journal => Path.Combine(directory, ".phase3-journal");
    private string Resolve(string key) => Guid.TryParseExact(key, "N", out _) ? Path.Combine(directory, key) : throw new InvalidDataException("Invalid storage identity.");
    private async Task Guard(CancellationToken ct) {
        if (!await gate.IsEnabledAsync(ct) || !directory.EndsWith(Path.Combine("artifacts", "phase2-isolated", "media"), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Submission file writes require the approved isolated database and media root.");
    }
    public async Task<PreparedSubmissionFile> PrepareAsync(Stream content, string name, string contentType, CancellationToken ct)
    {
        await Guard(ct); Directory.CreateDirectory(directory); Directory.CreateDirectory(Journal);
        var key = Guid.NewGuid().ToString("N"); var file = Resolve(key);
        var lease = new FileStream(Path.Combine(Journal, key + ".lease"), FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None);
        leases[key] = lease;
        try {
            await File.WriteAllTextAsync(Path.Combine(Journal, key + ".pending"), DateTimeOffset.UtcNow.ToString("O"), ct);
            await using (var output = new FileStream(file + ".upload", FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true)) {
                var buffer = new byte[81920]; long total = 0; int count;
                while ((count = await content.ReadAsync(buffer, ct)) != 0) {
                    total += count; if (total > MaximumBytes) throw new InvalidDataException("Attachment exceeds 10 MiB.");
                    await output.WriteAsync(buffer.AsMemory(0, count), ct);
                }
                if (total == 0) throw new InvalidDataException("Empty attachment.");
            }
            var bytes = await File.ReadAllBytesAsync(file + ".upload", ct);
            var safeName = LearnerSubmissionService.SafeFileName(name);
            var mime = Validate(bytes, Path.GetExtension(safeName).ToLowerInvariant(), contentType);
            File.Move(file + ".upload", file);
            return new(key, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), bytes.LongLength, mime, safeName);
        } catch {
            // SQL has not been entered: these newly generated files cannot be committed references.
            File.Delete(file + ".upload"); File.Delete(file); Release(key); File.Delete(Path.Combine(Journal, key + ".pending")); throw;
        }
    }
    public static string Validate(byte[] bytes, string extension, string contentType)
    {
        if (bytes.Length == 0 || bytes.LongLength > MaximumBytes) throw new InvalidDataException("Invalid attachment size.");
        var mime = extension switch { ".pdf" => "application/pdf", ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp", ".txt" => "text/plain", ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document", _ => throw new InvalidDataException("Unsupported file type.") };
        if (contentType != mime) throw new InvalidDataException("MIME mismatch.");
        bool valid;
        switch (extension) {
            case ".pdf":
                valid=SubmissionFileStructure.Pdf(bytes);break;
            case ".png":valid=SubmissionFileStructure.Png(bytes);break;
            case ".jpg":case ".jpeg":valid=SubmissionFileStructure.Jpeg(bytes);break;
            case ".webp":valid=SubmissionFileStructure.Webp(bytes);break;
            case ".txt":
                try { var text = new UTF8Encoding(false, true).GetString(bytes); valid = !text.Any(c => char.IsControl(c) && c is not ('\r' or '\n' or '\t')); }
                catch (DecoderFallbackException) { valid = false; } break;
            case ".docx": ValidateDocx(bytes); valid = true; break;
            default: valid = false; break;
        }
        if (!valid) throw new InvalidDataException("Malformed or mismatched attachment bytes."); return mime;
    }
    private static void ValidateDocx(byte[] bytes)
    {
        try {
            using var archive = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
            if (archive.Entries.Count is < 3 or > 256) throw new InvalidDataException("Invalid DOCX entry count.");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase); long expanded = 0; XDocument? types = null; bool document = false,officeRelationship=false;
            foreach (var entry in archive.Entries) {
                var name = entry.FullName;
                if (!names.Add(name) || name.StartsWith('/') || name.Contains('\\') || name.Split('/').Any(x => x == "..") || name.Length > 240
                    || name.EndsWith(".bin", StringComparison.OrdinalIgnoreCase) || name.Contains("embeddings/", StringComparison.OrdinalIgnoreCase)
                    || entry.Length > 20 * 1024 * 1024 || entry.Length > Math.Max(1, entry.CompressedLength) * 100) throw new InvalidDataException("Unsafe DOCX container.");
                expanded += entry.Length; if (expanded > 32 * 1024 * 1024) throw new InvalidDataException("DOCX expanded size exceeded.");
                using var input = entry.Open(); using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
                while ((count = input.Read(buffer)) != 0) { if (output.Length + count > entry.Length) throw new InvalidDataException("DOCX size mismatch."); output.Write(buffer,0,count); }
                if (output.Length != entry.Length) throw new InvalidDataException("Truncated DOCX.");
                if (name.EndsWith(".xml", StringComparison.OrdinalIgnoreCase) || name.EndsWith(".rels", StringComparison.OrdinalIgnoreCase)) {
                    output.Position = 0; using var reader = XmlReader.Create(output, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 20 * 1024 * 1024 });
                    var xml = XDocument.Load(reader);
                    if (xml.Descendants().Any(e => e.Attributes().Any(a => a.Name.LocalName == "TargetMode" && a.Value.Equals("External", StringComparison.OrdinalIgnoreCase)))) throw new InvalidDataException("External DOCX relationship.");
                    if (name == "[Content_Types].xml") types = xml;
                    if(name=="_rels/.rels")officeRelationship=xml.Descendants().Any(e=>(string?)e.Attribute("Type")=="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"&&(string?)e.Attribute("Target")=="word/document.xml");
                    if (name == "word/document.xml") document = xml.Root?.Name == XName.Get("document", "http://schemas.openxmlformats.org/wordprocessingml/2006/main");
                }
            }
            if (!document || !officeRelationship || types == null || !types.Descendants().Any(e => (string?)e.Attribute("PartName") == "/word/document.xml"
                && (string?)e.Attribute("ContentType") == "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")
                || types.ToString().Contains("macroEnabled", StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid DOCX document.");
        } catch (Exception e) when (e is XmlException or ArgumentException or NotSupportedException) { throw new InvalidDataException("Malformed DOCX.", e); }
    }
    public Task CompleteAsync(string key, CancellationToken ct) => ReconcileAsync(key, ct);
    public async Task ReconcileAsync(string key, CancellationToken ct)
    {
        await Guard(ct); var file = Resolve(key);
        var owned = leases.TryGetValue(key, out var active);
        FileStream? acquired = null;
        try {
            if (!owned) {
                var marker = Path.Combine(Journal, key + ".pending");
                if (!File.Exists(marker) || File.GetLastWriteTimeUtc(marker) > DateTime.UtcNow.AddHours(-24)) return;
                try { acquired = new FileStream(Path.Combine(Journal,key + ".lease"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); } catch (IOException) { return; }
            }
            // Any MediaAsset row is sufficient to retain bytes, including detached tombstones.
            // No deletion on an unavailable/ambiguous database; the journal remains retryable.
            if (!await db.MediaAssets.AsNoTracking().AnyAsync(x => x.StorageKey == key, ct)) { File.Delete(file); File.Delete(file + ".upload"); }
            File.Delete(Path.Combine(Journal, key + ".pending"));
        } finally { acquired?.Dispose(); if (owned) Release(key); }
    }
    private void Release(string key) { if (leases.TryRemove(key, out var lease)) lease.Dispose(); }
    public async Task<int> ReconcilePendingAsync(CancellationToken ct) {
        await Guard(ct); if (!Directory.Exists(Journal)) return 0; var count = 0;
        foreach (var marker in Directory.EnumerateFiles(Journal, "*.pending")) {
            var key = Path.GetFileNameWithoutExtension(marker); if (!Guid.TryParseExact(key, "N", out _)) continue;
            await ReconcileAsync(key, ct); if (!File.Exists(marker)) count++;
        }
        return count;
    }
    public void Dispose() { foreach (var key in leases.Keys) Release(key); }
}
