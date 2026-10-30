$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $env:TEMP 'esham-video-verification.json'
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($manifest.titleEn -ne 'Temporary video integration verification') { throw 'Unexpected verification manifest.' }
$courseId = [Guid]::Parse($manifest.courseId)
$mediaIds = @($manifest.mediaIds | ForEach-Object { [Guid]::Parse($_).ToString() })
$secretsPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/a664d104-d79c-4946-b86e-44581734e3b3/secrets.json'
$secrets = Get-Content -Raw $secretsPath | ConvertFrom-Json
$connection = [System.Data.SqlClient.SqlConnection]::new($secrets.'ConnectionStrings:DefaultConnection')
$connection.Open()
$transaction = $connection.BeginTransaction()
$keys = [System.Collections.Generic.List[string]]::new()
try {
    $command = $connection.CreateCommand(); $command.Transaction = $transaction
    $command.CommandText = @'
IF NOT EXISTS (SELECT 1 FROM Courses c JOIN CourseVersions v ON c.DraftVersionId=v.Id
 WHERE c.Id=@id AND c.OwnerUserId=@owner AND c.PublishedVersionId IS NULL AND v.TitleEn=@title AND v.ReviewStatus='draft')
 THROW 50000, 'Verification course guard failed', 1;
DECLARE @media TABLE (Id uniqueidentifier PRIMARY KEY);
INSERT @media SELECT DISTINCT CAST(value AS uniqueidentifier) FROM OPENJSON(@mediaIds);
INSERT @media SELECT DISTINCT a.MediaAssetId FROM LessonAttachments a JOIN Lessons l ON a.LessonId=l.Id
 JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id
 WHERE v.CourseId=@id AND NOT EXISTS(SELECT 1 FROM @media m WHERE m.Id=a.MediaAssetId);
IF EXISTS(SELECT 1 FROM MediaAssets a JOIN @media m ON a.Id=m.Id WHERE a.OwnerUserId<>@owner)
 THROW 50000, 'Media ownership guard failed', 1;
IF EXISTS(SELECT 1 FROM LessonAttachments a JOIN @media m ON a.MediaAssetId=m.Id JOIN Lessons l ON a.LessonId=l.Id
 JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId<>@id)
 THROW 50000, 'Shared media guard failed', 1;
SELECT a.StorageKey FROM MediaAssets a JOIN @media m ON a.Id=m.Id;
DELETE a FROM LessonAttachments a JOIN Lessons l ON a.LessonId=l.Id JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
UPDATE l SET PrimaryVideoMediaAssetId=NULL FROM Lessons l JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
DELETE r FROM ScreeningResults r JOIN @media m ON r.MediaAssetId=m.Id;
UPDATE a SET SourceMediaAssetId=NULL FROM MediaAssets a JOIN @media m ON a.Id=m.Id;
DELETE a FROM MediaAssets a JOIN @media m ON a.Id=m.Id;
DELETE l FROM Lessons l JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
DELETE s FROM CourseSections s JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
UPDATE Courses SET DraftVersionId=NULL WHERE Id=@id;
DELETE FROM CourseVersions WHERE CourseId=@id;
DELETE FROM Courses WHERE Id=@id;
'@
    $null = $command.Parameters.AddWithValue('@id', $courseId)
    $null = $command.Parameters.AddWithValue('@owner', $manifest.ownerId)
    $null = $command.Parameters.AddWithValue('@title', $manifest.titleEn)
    $null = $command.Parameters.AddWithValue('@mediaIds', (ConvertTo-Json -InputObject @($mediaIds) -Compress))
    $reader = $command.ExecuteReader()
    while ($reader.Read()) { $keys.Add($reader.GetString(0)) }
    while ($reader.NextResult()) { while ($reader.Read()) { } }
    $reader.Close()
    $mediaRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../backend/storage/media'))
    foreach ($key in $keys) {
        $parsed = [Guid]::Empty
        if (-not [Guid]::TryParseExact($key, 'N', [ref]$parsed)) { throw 'Unexpected storage key.' }
        $target = [System.IO.Path]::GetFullPath((Join-Path $mediaRoot $key))
        if (-not $target.StartsWith($mediaRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected storage path.' }
    }
    $transaction.Commit()
    foreach ($key in $keys) {
        $target = Join-Path $mediaRoot $key
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target }
    }
    Remove-Item -LiteralPath $manifestPath
    Write-Output 'Temporary video course, media metadata, screening placeholders, attachments, and tracked files removed.'
} catch { try { $transaction.Rollback() } catch { }; throw } finally { $connection.Dispose() }
