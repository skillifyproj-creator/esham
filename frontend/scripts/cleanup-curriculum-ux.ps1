$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $env:TEMP 'esham-curriculum-ux-cleanup.json'
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($manifest.titleEn -ne 'Temporary curriculum UX verification') { throw 'Unexpected verification manifest.' }
$courseId = [Guid]::Parse($manifest.courseId)
$secretsPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/a664d104-d79c-4946-b86e-44581734e3b3/secrets.json'
$secrets = Get-Content -Raw $secretsPath | ConvertFrom-Json
$connection = [System.Data.SqlClient.SqlConnection]::new($secrets.'ConnectionStrings:DefaultConnection')
$connection.Open()
$transaction = $connection.BeginTransaction()
try {
    $command = $connection.CreateCommand()
    $command.Transaction = $transaction
    $command.CommandText = @'
IF NOT EXISTS (SELECT 1 FROM Courses c JOIN CourseVersions v ON c.DraftVersionId=v.Id
 WHERE c.Id=@id AND c.OwnerUserId=@owner AND c.PublishedVersionId IS NULL AND v.TitleEn=@title AND v.ReviewStatus='draft')
 THROW 50000, 'Verification course guard failed', 1;
DELETE l FROM Lessons l JOIN CourseSections s ON l.CourseSectionId=s.Id JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
DELETE s FROM CourseSections s JOIN CourseVersions v ON s.CourseVersionId=v.Id WHERE v.CourseId=@id;
UPDATE Courses SET DraftVersionId=NULL WHERE Id=@id;
DELETE FROM CourseVersions WHERE CourseId=@id;
DELETE FROM Courses WHERE Id=@id;
'@
    $null = $command.Parameters.AddWithValue('@id', $courseId)
    $null = $command.Parameters.AddWithValue('@owner', $manifest.ownerId)
    $null = $command.Parameters.AddWithValue('@title', $manifest.titleEn)
    $null = $command.ExecuteNonQuery()
    $transaction.Commit()
    Remove-Item -LiteralPath $manifestPath
    Write-Output 'Temporary verification course and curriculum removed; original courses untouched.'
} catch { $transaction.Rollback(); throw } finally { $connection.Dispose() }
