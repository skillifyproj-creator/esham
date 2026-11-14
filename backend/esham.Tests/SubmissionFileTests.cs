using System.IO.Compression;
using System.Text;
using esham.DAL.Data;
using esham.DAL.Entities;
using esham.PL.Storage;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using static esham.Tests.AccountFinalizationTests;
namespace esham.Tests;
public sealed class SubmissionFileTests
{
    internal static byte[] Docx(bool external=false,string? extra=null) {
        using var memory=new MemoryStream();using(var zip=new ZipArchive(memory,ZipArchiveMode.Create,true)) {
            var entries=new Dictionary<string,string>{["[Content_Types].xml"]="<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>",
                ["_rels/.rels"]=external?"<Relationships><Relationship TargetMode=\"External\" Target=\"https://evil.test\"/></Relationships>":"<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>",
                ["word/document.xml"]="<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Work</w:t></w:r></w:p></w:body></w:document>"};
            if(extra!=null)entries[extra]="data";
            foreach(var entry in entries){using var writer=new StreamWriter(zip.CreateEntry(entry.Key).Open());writer.Write(entry.Value);}
        }return memory.ToArray();
    }
    [Fact] public void Types_structure_mime_size_and_container_abuse_are_checked() {
        Assert.Equal("text/plain",SubmissionAttachmentWriter.Validate(Encoding.UTF8.GetBytes("A real answer\nإجابة"),".txt","text/plain"));
        const string mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        Assert.Equal(mime,SubmissionAttachmentWriter.Validate(Docx(),".docx",mime));
        foreach(var bytes in new[]{Docx(true),Docx(extra:"../outside.txt"),Docx(extra:"word/vbaProject.bin"),new byte[]{0x50,0x4b,3,4}})
            Assert.ThrowsAny<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate(bytes,".docx",mime));
        Assert.Throws<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate(new byte[10*1024*1024+1],".txt","text/plain"));
        Assert.Throws<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate([0,1,2],".txt","text/plain"));
        Assert.Throws<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate("answer"u8.ToArray(),".doc","application/msword"));
        Assert.Throws<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate("answer"u8.ToArray(),".pdf","text/plain"));
        foreach(var item in new[]{(".pdf","application/pdf"),(".png","image/png"),(".jpeg","image/jpeg"),(".webp","image/webp")})
            Assert.Throws<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate("spoofed bytes"u8.ToArray(),item.Item1,item.Item2));
    }
    [Fact] public void Docx_expanded_size_ratio_entry_count_and_xml_entities_are_bounded() {
        const string mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        foreach(var mode in new[]{"ratio","entries","xml"}) {
            using var memory=new MemoryStream();using(var zip=new ZipArchive(memory,ZipArchiveMode.Create,true)) {
                var count=mode=="entries"?257:1;
                for(var n=0;n<count;n++){using var writer=new StreamWriter(zip.CreateEntry(n+".xml",CompressionLevel.SmallestSize).Open());writer.Write(mode=="ratio"?new string('A',100000):mode=="xml"?"<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///secret'>]><x>&e;</x>":"<x/>");}
            }
            Assert.ThrowsAny<InvalidDataException>(()=>SubmissionAttachmentWriter.Validate(memory.ToArray(),".docx",mime));
        }
    }
    [Fact] public async Task Journal_reconciles_only_owned_unreferenced_files_and_preserves_committed_metadata() {
        using var provider=Services();using var scope=provider.CreateScope();var s=scope.ServiceProvider;var db=s.GetRequiredService<AppDbContext>();
        var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../phase3-isolated/file-unit/",Guid.NewGuid().ToString("N"),"artifacts/phase2-isolated/media"));
        using var writer=new SubmissionAttachmentWriter(db,new LearnerSubmissionTests.MemoryGate(db),root);
        var one=await writer.PrepareAsync(new MemoryStream("work"u8.ToArray()),"../safe.txt","text/plain",default);
        Assert.DoesNotContain('/',one.Name);Assert.True(File.Exists(Path.Combine(root,one.Key)));
        await writer.ReconcileAsync(one.Key,default);Assert.False(File.Exists(Path.Combine(root,one.Key)));
        var two=await writer.PrepareAsync(new MemoryStream("saved"u8.ToArray()),"saved.txt","text/plain",default);
        db.MediaAssets.Add(new(){OwnerUserId="synthetic",StorageKey=two.Key,ContentHash=two.Hash,SizeBytes=two.Size,OriginalFileName=two.Name,MimeType=two.ContentType,MediaType="attachment"});await db.SaveChangesAsync();
        await writer.ReconcileAsync(two.Key,default);Assert.True(File.Exists(Path.Combine(root,two.Key)));
        var three=await writer.PrepareAsync(new MemoryStream("interrupted"u8.ToArray()),"work.txt","text/plain",default);writer.Dispose();
        var marker=Path.Combine(root,".phase3-journal",three.Key+".pending");File.SetLastWriteTimeUtc(marker,DateTime.UtcNow.AddDays(-2));
        using var recovery=new SubmissionAttachmentWriter(db,new LearnerSubmissionTests.MemoryGate(db),root);
        Assert.Equal(1,await recovery.ReconcilePendingAsync(default));Assert.False(File.Exists(Path.Combine(root,three.Key)));
        Assert.True(File.Exists(Path.Combine(root,two.Key))); // Never sweep unrelated/referenced bytes.
        var active=await recovery.PrepareAsync(new MemoryStream("active upload"u8.ToArray()),"active.txt","text/plain",default);
        File.SetLastWriteTimeUtc(Path.Combine(root,".phase3-journal",active.Key+".pending"),DateTime.UtcNow.AddDays(-2));
        using var competing=new SubmissionAttachmentWriter(db,new LearnerSubmissionTests.MemoryGate(db),root);
        Assert.Equal(0,await competing.ReconcilePendingAsync(default));Assert.True(File.Exists(Path.Combine(root,active.Key)));
        await recovery.ReconcileAsync(active.Key,default);
    }
    private sealed class BrokenStream:MemoryStream {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer,CancellationToken ct=default)=>throw new IOException("Injected file streaming failure.");
    }
    [Fact] public async Task Streaming_failure_removes_only_its_new_temporary_file(){
        using var p=Services();using var scope=p.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var root=Path.Combine(AppContext.BaseDirectory,"file-failure",Guid.NewGuid().ToString("N"),"artifacts/phase2-isolated/media");
        using var writer=new SubmissionAttachmentWriter(db,new LearnerSubmissionTests.MemoryGate(db),root);
        await Assert.ThrowsAsync<IOException>(()=>writer.PrepareAsync(new BrokenStream(),"work.txt","text/plain",default));
        Assert.Empty(Directory.EnumerateFiles(root));Assert.Empty(Directory.EnumerateFiles(Path.Combine(root,".phase3-journal"),"*.pending"));
    }
}
