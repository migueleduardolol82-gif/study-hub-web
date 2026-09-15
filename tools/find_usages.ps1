[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Symbol
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Symbol)) {
    Write-Host 'Uso: .\tools\find_usages.ps1 <símbolo>'
    exit 2
}

if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Write-Error 'O comando rg (ripgrep) não está disponível no PATH.'
    exit 1
}

$sourceRoots = @('app', 'components', 'lib', 'tests', 'scripts') |
    ForEach-Object { Join-Path $projectRoot $_ } |
    Where-Object { Test-Path -LiteralPath $_ }

$rgArgs = @(
    '--fixed-strings', '--word-regexp', '--line-number', '--no-heading', '--color', 'never',
    '--glob', '*.{ts,tsx,js,jsx,mjs,cjs,css,scss,json}',
    '--glob', '!node_modules/**', '--glob', '!.next/**', '--glob', '!dist/**',
    '--glob', '!build/**', '--glob', '!coverage/**', '--glob', '!test-results/**',
    '--', $Symbol
) + $sourceRoots

$matches = & rg @rgArgs 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -eq 1) {
    Write-Host "Nenhum uso encontrado para: $Symbol"
    exit 0
}
if ($exitCode -ne 0) { exit $exitCode }

$grouped = [ordered]@{}
foreach ($match in $matches) {
    $text = [string]$match
    if ($text -match '^(.*?):(\d+):') {
        $file = $Matches[1]
        $lineNumber = $Matches[2]
        if (-not $grouped.Contains($file)) { $grouped[$file] = @() }
        $grouped[$file] += $lineNumber
    }
}

foreach ($file in $grouped.Keys) {
    Write-Output $file
    foreach ($lineNumber in $grouped[$file]) { Write-Output "  $lineNumber" }
    Write-Output ''
}
