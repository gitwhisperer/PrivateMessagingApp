<#
SYNOPSIS
  Automated testnet contract deployment via Clarinet (tries multiple command variants) for Windows PowerShell.

DESCRIPTION
  1. Validates mnemonic (existing validate-mnemonic.ps1).
  2. Generates a deployment plan (plural or singular subcommand depending on Clarinet version).
  3. Applies (broadcasts) the plan, attempting variants until a txid is detected.
  4. Prints the txid, suggested Explorer URL, and instructs to update README & contract-address.txt.

PARAMETER ContractName
  Contract name (defaults to private-messaging)

NOTES
  Testnet only. Ensure the deployer address has STX from faucet first.
#>

Param(
  [string]$ContractName = 'private-messaging',
  [switch]$SkipValidate
)

$ErrorActionPreference = 'Stop'
function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  # Go to project root of Clarinet (one up from scripts)
  Set-Location ..

  if (-not $SkipValidate) {
    if (Test-Path ./scripts/validate-mnemonic.ps1) {
      Write-Info 'Validating mnemonic...'
      powershell -ExecutionPolicy Bypass -File ./scripts/validate-mnemonic.ps1 ./settings/Testnet.toml
      if ($LASTEXITCODE -ne 0) { Write-Err "Mnemonic validation failed (exit $LASTEXITCODE)."; exit 2 }
    } else { Write-Warn 'Mnemonic validator script missing; continuing without validation.' }
  }

  $planDir = 'deployments'
  if (-not (Test-Path $planDir)) { New-Item -ItemType Directory -Path $planDir | Out-Null }

  # Clarinet version in use does NOT support --output. Default file name is default.testnet-plan.yaml
  $defaultPlan = Join-Path $planDir 'default.testnet-plan.yaml'

  if (Test-Path $defaultPlan) {
    Write-Info "Existing plan found: $defaultPlan (will regenerate)"
    Remove-Item $defaultPlan -Force
  }

  $generateVariants = @(
    # Primary (plural) with explicit low-cost strategy (required by your Clarinet version)
    "clarinet deployments generate --testnet --low-cost",
    # Try medium as alternative in case low-cost flag mis-parses
    "clarinet deployments generate --testnet --medium-cost",
    # Singular subcommand fallbacks
    "clarinet deployment generate --testnet --low-cost",
    "clarinet deployment generate --testnet --medium-cost"
  )

  $generated = $false
  foreach ($cmd in $generateVariants) {
    Write-Info "Attempting plan generation: $cmd"
    try {
      powershell -c $cmd
      if (Test-Path $defaultPlan) { $generated = $true; break }
    } catch { Write-Warn "Failed: $cmd -> $($_.Exception.Message)" }
  }
  if (-not $generated) {
    # If generation failed but any *.testnet-plan.yaml exists, pick first as fallback
    $anyPlan = Get-ChildItem $planDir -Filter '*.testnet-plan.yaml' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($anyPlan) {
      Write-Warn "Could not run generation commands cleanly; falling back to existing plan: $($anyPlan.FullName)"
      $defaultPlan = $anyPlan.FullName
      $generated = $true
    }
  }
  if (-not $generated) { Write-Err 'Could not generate (or find) a deployment plan. Aborting.'; exit 3 }
  $planFile = $defaultPlan
  Write-Info "Plan ready: $planFile"

  # (Optional) contract-name patch omitted for this Clarinet version; assuming plan has correct name.

  $applyVariants = @(
    # Your Clarinet version expects a cost strategy on apply (no --plan/--broadcast flags)
    "clarinet deployments apply --testnet --low-cost",
    "clarinet deployments apply --testnet --medium-cost",
    "clarinet deployment apply --testnet --low-cost",
    "clarinet deployment apply --testnet --medium-cost",
    # fallback plain
    "clarinet deployments apply --testnet",
    "clarinet deployment apply --testnet"
  )

  $txid = $null
  foreach($cmd in $applyVariants){
    Write-Info "Applying plan: $cmd"
    try {
      $out = powershell -c $cmd 2>&1 | Out-String
      Write-Host $out
      if ($out -match '0x[a-fA-F0-9]{64}') {
        $txid = ($out | Select-String -Pattern '0x[a-fA-F0-9]{64}' -AllMatches).Matches[0].Value
        Write-Info "Detected txid: $txid"
        break
      }
      if ($out -match 'Contract already exists') { Write-Warn 'Contract already exists on this address with that name.' }
      if ($out -match 'insufficient' -or $out -match 'balance') { Write-Warn 'Possible insufficient balance; faucet-fund deployer and retry.' }
    } catch { Write-Warn "Failed: $cmd -> $($_.Exception.Message)" }
  }
  if (-not $txid) {
    Write-Err 'Failed to detect a broadcast txid. Likely only simulation was run.'
    Write-Host 'Next steps:' -ForegroundColor Yellow
    Write-Host ' 1. Ensure deployer testnet address is funded.' -ForegroundColor Yellow
    Write-Host ' 2. Try manual deploy via Explorer Sandbox: https://explorer.hiro.so/sandbox?chain=testnet' -ForegroundColor Yellow
    Write-Host ' 3. Or request a Node.js broadcast script (reply: add script).' -ForegroundColor Yellow
    exit 4
  }

  Write-Host ''
  Write-Host '===================================================' -ForegroundColor Green
  Write-Host "Deployment Transaction ID: $txid" -ForegroundColor Green
  Write-Host 'Explorer TX (open after a minute if 404 now):' -ForegroundColor Green
  Write-Host "https://explorer.hiro.so/tx/$txid?chain=testnet" -ForegroundColor Cyan
  Write-Host 'Update README and contract-address.txt with txid & block height once confirmed.' -ForegroundColor Green
  Write-Host '===================================================' -ForegroundColor Green
  exit 0
}
finally { Pop-Location }
