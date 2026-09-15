[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Reference
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error 'O comando git não está disponível no PATH.'
    exit 1
}

& git -C $projectRoot rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Não é um repositório Git: $projectRoot"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Reference)) {
    $files = & git -C $projectRoot diff --name-only HEAD
} else {
    & git -C $projectRoot rev-parse --verify "$Reference^{commit}" *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Referência Git inválida: $Reference"
        Write-Host 'Uso: .\tools\list_changed_files.ps1 [branch-ou-commit]'
        exit 2
    }
    $files = & git -C $projectRoot diff --name-only "$Reference...HEAD"
}

$ignored = '^(node_modules|\.next|dist|build|coverage|test-results|bin|obj|vendor|__pycache__)/'
$filtered = @($files | Where-Object { $_ -and ($_ -replace '\\', '/') -notmatch $ignored })
$filtered | ForEach-Object { Write-Output $_ }
Write-Output "Total: $($filtered.Count) arquivo(s)"
