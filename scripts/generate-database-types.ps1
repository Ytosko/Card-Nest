$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $projectRoot '.env'
$outputDirectory = Join-Path $projectRoot 'src\types'
$outputPath = Join-Path $outputDirectory 'database.types.ts'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw 'A local .env is required to generate linked database types.'
}

$values = @{}
Get-Content -LiteralPath $envPath | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

if (-not $values['SUPABASE_ACCESS_TOKEN']) {
  throw 'SUPABASE_ACCESS_TOKEN is not configured.'
}

$env:SUPABASE_ACCESS_TOKEN = $values['SUPABASE_ACCESS_TOKEN']
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

$generated = & npx supabase gen types --linked --lang typescript --schema public
if ($LASTEXITCODE -ne 0) {
  throw 'Supabase type generation failed.'
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($outputPath, [string[]]$generated, $utf8WithoutBom)
Write-Output 'Generated src/types/database.types.ts without displaying credentials.'
