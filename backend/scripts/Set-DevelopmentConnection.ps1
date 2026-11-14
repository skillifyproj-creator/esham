param(
    # Optional private file containing only the approved SQL Server connection string.
    [string]$ConnectionStringFile
)

$ErrorActionPreference = 'Stop'
$projectPath = Join-Path $PSScriptRoot '../esham.PL/esham.PL.csproj'
$connection = $null
$secureInput = $null
$buffer = [IntPtr]::Zero
$previousOutputEncoding = $OutputEncoding

try {
    if ($ConnectionStringFile) {
        $connection = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ConnectionStringFile).Path).Trim()
    }
    else {
        $secureInput = Read-Host 'Approved SQL Server connection string (hidden; not shell history)' -AsSecureString
        $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
        $connection = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer)
    }

    if ([string]::IsNullOrWhiteSpace($connection)) {
        throw 'A connection string approved by the database coordinator is required.'
    }

    # JSON on stdin avoids placing credentials in command arguments or shell history.
    # User Secrets merges these keys, preserving unrelated settings.
    $settings = @{
        'ConnectionStrings:DefaultConnection' = $connection
        'SeedData:Enabled' = 'false'
        'SeedData:DemoCourses' = 'false'
    }
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    $settings | ConvertTo-Json -Compress | dotnet user-secrets set --project $projectPath 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not save User Secrets. Check .NET SDK installation and access to the Windows User Secrets directory.'
    }
    Write-Output 'Development connection saved in User Secrets; startup seeding disabled. No database connection or schema command was executed.'
}
finally {
    $OutputEncoding = $previousOutputEncoding
    if ($buffer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer)
    }
    if ($secureInput) { $secureInput.Dispose() }
    $connection = $null
    $settings = $null
}
