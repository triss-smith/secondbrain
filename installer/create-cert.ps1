# Run once to generate a self-signed code signing certificate.
# Requires PowerShell running as Administrator.
#
# Usage: powershell -ExecutionPolicy Bypass -File installer\create-cert.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Second Brain Certificate Generator ===" -ForegroundColor Cyan
Write-Host ""

# Create the certificate in the current user's store
$cert = New-SelfSignedCertificate `
    -Type CodeSigning `
    -Subject "CN=Second Brain" `
    -KeyUsage DigitalSignature `
    -FriendlyName "Second Brain Code Signing" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3") `
    -NotAfter (Get-Date).AddYears(5)

Write-Host "Certificate created. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
Write-Host ""

# Prompt for export password
$password = Read-Host "Enter a password to protect the certificate file" -AsSecureString

# Export to PFX alongside this script
$pfxPath = Join-Path $PSScriptRoot "SecondBrain.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

Write-Host ""
Write-Host "Saved to: $pfxPath" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Remember your password — you will need it every time you run build.bat." -ForegroundColor Yellow
Write-Host "Do not commit SecondBrain.pfx to git." -ForegroundColor Yellow
