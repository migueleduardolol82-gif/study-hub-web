[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Path)) {
    Write-Host 'Uso: .\tools\summarize_file.ps1 <caminho-do-arquivo>'
    exit 2
}

$candidate = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $projectRoot $Path }
if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    Write-Host "Arquivo não encontrado: $Path"
    Write-Host 'Uso: .\tools\summarize_file.ps1 <caminho-do-arquivo>'
    exit 2
}

$resolved = (Resolve-Path -LiteralPath $candidate).Path
$lines = @(Get-Content -LiteralPath $resolved)
$total = $lines.Count

Write-Output "Arquivo: $resolved"
Write-Output "Total de linhas: $total"
Write-Output '===== TOPO (primeiras 40 linhas) ====='
$lines | Select-Object -First 40
Write-Output '===== FIM (últimas 20 linhas) ====='
$lines | Select-Object -Last 20
