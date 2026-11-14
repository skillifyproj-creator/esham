using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
namespace esham.PL.Storage;
internal static class SubmissionFileStructure
{
    public static bool Pdf(byte[] bytes) {
        var text=Encoding.Latin1.GetString(bytes);
        if(!Regex.IsMatch(text,@"\A%PDF-(1\.[0-7]|2\.0)(\r|\n)") || text.LastIndexOf("%%EOF",StringComparison.Ordinal)<Math.Max(0,text.Length-1024))return false;
        if(Regex.IsMatch(text,@"/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b",RegexOptions.IgnoreCase))return false;
        var offsets=Regex.Matches(text,@"startxref\s+(\d+)\s+%%EOF",RegexOptions.CultureInvariant);
        if(offsets.Count==0||!int.TryParse(offsets[^1].Groups[1].Value,out var offset)||offset<0||offset>=bytes.Length)return false;
        var tail=text[offset..];
        if(!tail.StartsWith("xref",StringComparison.Ordinal)&&!Regex.IsMatch(tail,@"\A\d+\s+\d+\s+obj\s*<<[^>]*?/Type\s*/XRef",RegexOptions.Singleline))return false;
        var root=Regex.Match(text,@"/Root\s+(\d+)\s+(\d+)\s+R");
        return root.Success&&Regex.IsMatch(text,$@"\b{root.Groups[1].Value}\s+{root.Groups[2].Value}\s+obj\s*<<[^>]*?/Type\s*/Catalog\b",RegexOptions.Singleline);
    }
    public static bool Png(byte[] bytes) {
        if(bytes.Length<45||!bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))return false;
        var offset=8;bool header=false,end=false,data=false;long expected=0;using var compressed=new MemoryStream();
        while(offset+12<=bytes.Length){
            var length=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset,4));if(length>bytes.Length-offset-12)return false;var n=(int)length;
            var type=Encoding.ASCII.GetString(bytes,offset+4,4);var crc=0xffffffffu;
            for(var i=offset+4;i<offset+8+n;i++){crc^=bytes[i];for(var bit=0;bit<8;bit++)crc=(crc&1)!=0?0xedb88320u^(crc>>1):crc>>1;}
            if((crc^0xffffffffu)!=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset+8+n,4)))return false;
            if(!header&&type!="IHDR")return false;
            if(type=="IHDR"){
                if(header||n!=13)return false;header=true;
                var width=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset+8,4));var height=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(offset+12,4));
                var depth=bytes[offset+16];var color=bytes[offset+17];var channels=color switch{0=>1,2=>3,3=>1,4=>2,6=>4,_=>0};
                if(width==0||height==0||width>16384||height>16384||channels==0||depth is not(1 or 2 or 4 or 8 or 16)||bytes[offset+18]!=0||bytes[offset+19]!=0||bytes[offset+20]>1)return false;
                // Bound decompression even for interlaced files; exact scanline checking is for non-interlaced PNG.
                expected=((long)width*channels*depth+7)/8*height+height;
                if(expected>64*1024*1024)return false;if(bytes[offset+20]==1)expected=-Math.Min(64*1024*1024,Math.Abs(expected)*2);
            }
            if(type=="IDAT"){data=true;compressed.Write(bytes,offset+8,n);}
            offset+=n+12;if(type=="IEND"){end=n==0&&offset==bytes.Length;break;}
        }
        if(!header||!data||!end)return false;
        try{compressed.Position=0;using var zlib=new ZLibStream(compressed,CompressionMode.Decompress);var buffer=new byte[8192];long total=0;int count;
            while((count=zlib.Read(buffer))!=0){total+=count;if(total>Math.Abs(expected))return false;}return expected<0?total>0:total==expected;
        }catch(InvalidDataException){return false;}
    }
    public static bool Jpeg(byte[] bytes) {
        if(bytes.Length<12||bytes[0]!=255||bytes[1]!=216||bytes[^2]!=255||bytes[^1]!=217)return false;
        var offset=2;bool frame=false;
        while(offset+4<=bytes.Length){
            if(bytes[offset++]!=255)return false;while(offset<bytes.Length&&bytes[offset]==255)offset++;if(offset>=bytes.Length)return false;
            var marker=bytes[offset++];if(marker==0xda)return frame&&offset+2<bytes.Length;
            if(marker is 0xd9 or 0xd8)return false;if(marker is >=0xd0 and <=0xd7)continue;
            var length=BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset,2));if(length<2||offset+length>bytes.Length)return false;
            if(marker is 0xc0 or 0xc1 or 0xc2){if(length<8||BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset+3,2))==0||BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(offset+5,2))==0)return false;frame=true;}
            offset+=length;
        }return false;
    }
    public static bool Webp(byte[] bytes) {
        if(bytes.Length<20||!bytes.AsSpan(0,4).SequenceEqual("RIFF"u8)||!bytes.AsSpan(8,4).SequenceEqual("WEBP"u8)||BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(4,4))!=bytes.Length-8)return false;
        var offset=12;bool image=false;
        while(offset+8<=bytes.Length){var kind=Encoding.ASCII.GetString(bytes,offset,4);var n=BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(offset+4,4));if(n>bytes.Length-offset-8)return false;
            if(kind=="VP8 ")image=n>=10&&bytes.AsSpan(offset+11,3).SequenceEqual(new byte[]{0x9d,0x01,0x2a});
            if(kind=="VP8L")image=n>=5&&bytes[offset+8]==0x2f;
            offset+=8+(int)n+((int)n&1);
        }return image&&offset==bytes.Length;
    }
}
