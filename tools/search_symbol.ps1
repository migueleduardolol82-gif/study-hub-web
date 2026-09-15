[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Term
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Term)) {
    Write-Host 'Uso: .\tools\search_symbol.ps1 <termo>'
    exit 2
}

if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
    Write-Error 'O comando rg (ripgrep) não está disponível no PATH.'
    exit 1
}

$sourceRoots = @('app', 'components', 'lib', 'tests', 'scripts') |
    ForEach-Object { Join-Path $projectRoot $_ } |
    Where-Object { Test-Path -LiteralPath $_ }

if ($sourceRoots.Count -eq 0) {
    Write-Error 'Nenhuma pasta de código-fonte foi encontrada.'
    exit 1
}

$rgArgs = @(
    '--fixed-strings', '--line-number', '--column', '--context', '2', '--color', 'never',
    '--glob', '*.{ts,tsx,js,jsx,mjs,cjs,css,scss,json}',
    '--glob', '!node_modules/**', '--glob', '!.next/**', '--glob', '!dist/**',
    '--glob', '!build/**', '--glob', '!coverage/**', '--glob', '!test-results/**',
    '--', $Term
) + $sourceRoots

$output = & rg @rgArgs 2>&1
$exitCode = $LASTEXITCODE

foreach ($line in $output) {
    $text = [string]$line
    if ($text -match '^.+?:\d+:\d+:(.*)$') {
        $matchedText = $Matches[1].Trim()
        if ($matchedText -match '^(//|/\*|\*|#|<!--)') { continue }
    }
    Write-Output $text
}

if ($exitCode -eq 1) {
    Write-Host "Nenhum resultado para: $Term"
    exit 0
}

exit $exitCode
