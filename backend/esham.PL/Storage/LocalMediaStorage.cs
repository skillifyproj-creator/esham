using System.Security.Cryptography;
using esham.BLL.DTOs.Courses;
using esham.BLL.Interfaces;
namespace esham.PL.Storage;

// Development persistence only. No public static-file mount; reads require course/lesson authorization.
public sealed class LocalMediaStorage(string root, long maxBytes = 2L * 1024 * 1024 * 1024) : IMediaStorage
{
    private readonly string directory = Path.GetFullPath(root);
    private string Resolve(string key)
    {
        if (!Guid.TryParseExact(key, "N", out _)) throw new InvalidDataException("Invalid media storage key.");
        return Path.Combine(directory, key);
    }
    public async Task<StoredMediaFile> SaveAsync(Stream input, string contentType, CancellationToken ct)
    {
        Directory.CreateDirectory(directory);
        var key = Guid.NewGuid().ToString("N");
        var target = Resolve(key);
        var temporary = target + ".upload";
        try
        {
            var image = contentType is "image/png" or "image/jpeg" or "image/webp";
            var limit = image ? Math.Min(maxBytes, 2L * 1024 * 1024) : maxBytes;
            long size = 0;
            var prefix = new byte[12]; var prefixLength = 0;
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            {
                var buffer = new byte[81920]; int count;
                while ((count = await input.ReadAsync(buffer, ct)) != 0)
                {
                    size += count;
                    if (size > limit) throw new InvalidDataException(image ? "Cover image exceeds the 2MB upload limit." : "Video exceeds the 2GB upload limit.");
                    var take = Math.Min(count, prefix.Length - prefixLength);
                    buffer.AsSpan(0, take).CopyTo(prefix.AsSpan(prefixLength)); prefixLength += take;
                    hash.AppendData(buffer, 0, count);
                    await output.WriteAsync(buffer.AsMemory(0, count), ct);
                }
            }
            var webm = prefixLength >= 4 && prefix[0] == 0x1a && prefix[1] == 0x45 && prefix[2] == 0xdf && prefix[3] == 0xa3;
            var iso = prefixLength >= 12 && prefix.AsSpan(4, 4).SequenceEqual("ftyp"u8);
            var valid = contentType switch
            {
                "image/png" => prefixLength >= 8 && prefix.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                "image/jpeg" => prefixLength >= 3 && prefix[0] == 255 && prefix[1] == 216 && prefix[2] == 255,
                "image/webp" => prefixLength >= 12 && prefix.AsSpan(0, 4).SequenceEqual("RIFF"u8) && prefix.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                "video/webm" => webm,
                "video/mp4" or "video/quicktime" => iso,
                _ => false,
            };
            if (size == 0 || !valid) throw new InvalidDataException("Media bytes do not match the declared supported format.");
            File.Move(temporary, target);
            return new(key, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(), size, contentType);
        }
        catch { File.Delete(temporary); throw; }
    }
    public Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var file = Resolve(key);
        return Task.FromResult<Stream?>(File.Exists(file) ? new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true) : null);
    }
    public Task DeleteAsync(string key, CancellationToken ct) { File.Delete(Resolve(key)); return Task.CompletedTask; }
}
