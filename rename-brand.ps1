# rename-brand.ps1
# Bulk rename Qued -> Cractal across frontend and backend
# Run from project root: .\rename-brand.ps1
#
# This handles SAFE replacements only:
#   - qued.in -> cractal.in (domain references)
#   - @qued.in -> @cractal.in (email addresses)
#   - "Qued" as standalone brand text -> "Cractal"
#
# It does NOT touch:
#   - Logo components with split "Qu" + "ed" styling (manual fix needed)
#   - Referral code generation logic (no text change needed there)
#
# ALWAYS commit or backup before running, and review the diff after.

$ErrorActionPreference = "Stop"

Write-Host "Scanning for files to update..." -ForegroundColor Cyan

# Frontend: .tsx and .ts files
$frontendFiles = Get-ChildItem -Recurse -Include "*.tsx","*.ts" -Path "frontend\src" |
    Where-Object { (Select-String -Path $_.FullName -Pattern "Qued|qued\.in" -CaseSensitive -Quiet) }

# Backend: .py files
$backendFiles = Get-ChildItem -Recurse -Include "*.py" -Path "backend" |
    Where-Object { (Select-String -Path $_.FullName -Pattern "Qued|qued\.in" -CaseSensitive -Quiet) }

$allFiles = $frontendFiles + $backendFiles
Write-Host "Found $($allFiles.Count) files with Qued references." -ForegroundColor Yellow

$counter = 0
foreach ($file in $allFiles) {
    $content = Get-Content -Path $file.FullName -Raw

    # Order matters — most specific patterns first

    # 1. Domain references (qued.in -> cractal.in)
    $content = $content -replace "qued\.in", "cractal.in"

    # 2. Email addresses already covered by domain replace above
    #    (hello@qued.in -> hello@cractal.in happens automatically)

    # 3. Standalone brand word "Qued" -> "Cractal"
    #    Matches whole word only, case-sensitive, to avoid touching
    #    unrelated substrings
    $content = $content -replace "\bQued\b", "Cractal"

    Set-Content -Path $file.FullName -Value $content -NoNewline
    $counter++
    Write-Host "  Updated: $($file.FullName)" -ForegroundColor Green
}

Write-Host "`nDone. $counter files updated." -ForegroundColor Cyan
Write-Host "IMPORTANT: Now manually check these for logo-styling components:" -ForegroundColor Yellow
Write-Host "  - Navbar.tsx (logo with Qu/ed split styling)"
Write-Host "  - Footer.tsx (logo)"
Write-Host "  - signup/page.tsx (logo)"
Write-Host "  - login/page.tsx (logo)"
Write-Host "  - Any other component with 'Qu<span>' pattern"
Write-Host "`nRun this to find them:"
Write-Host '  Get-ChildItem -Recurse -Include "*.tsx" -Path "frontend\src" | Select-String -Pattern "Qu.*<span|Cractal.*<span" | Select-Object Path, LineNumber'