Param(
  [string]$FilePath = "./settings/Testnet.toml"
)

if (!(Test-Path $FilePath)) {
  # Fallback attempt (older docs): one directory up
  $alt = "../settings/Testnet.toml"
  if (Test-Path $alt) {
    Write-Host "Provided path not found ($FilePath) but found $alt instead; using it." -ForegroundColor Yellow
    $FilePath = $alt
  } else {
    Write-Error "File not found: $FilePath (cwd: $(Get-Location))"; 
    Write-Host "Existing settings files:" -ForegroundColor Yellow
    Get-ChildItem -Path ./settings -Filter *.toml -ErrorAction SilentlyContinue | ForEach-Object { Write-Host " - $_" }
    exit 1
  }
}

$raw = Get-Content $FilePath -Raw
# Extract mnemonic value between quotes after mnemonic =
if ($raw -match 'mnemonic\s*=\s*"([^"]+)"') {
  $mnemonic = $Matches[1]
} else {
  Write-Error "Mnemonic line not found in file."; exit 1
}
$words = $mnemonic.Trim().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
$len = $words.Length
$validCounts = 12,15,18,21,24
if ($validCounts -notcontains $len) {
  Write-Host "Invalid word count: $len (Allowed: 12,15,18,21,24)" -ForegroundColor Red
  Write-Host "Words: $mnemonic" -ForegroundColor DarkGray
  exit 2
}
# Basic BIP39 dictionary sanity (length >= 3 each)
$short = $words | Where-Object { $_.Length -lt 3 }
if ($short) {
  Write-Host "Some words look too short to be BIP39: $($short -join ', ')" -ForegroundColor Yellow
}
Write-Host "Mnemonic appears valid with $len words." -ForegroundColor Green
exit 0
