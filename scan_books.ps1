# DSA Grinder Books Scanner (PowerShell Native)
# Strict Policy: Zero emojis

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$booksDir = Join-Path $scriptDir "books"

if (-not (Test-Path $booksDir)) {
    New-Item -ItemType Directory -Path $booksDir -Force | Out-Null
}

$supported = @(".pdf")
$ignore = @("readme.txt", "readme.md", ".gitkeep", "desktop.ini", ".ds_store")

$items = Get-ChildItem -Path $booksDir -File | Where-Object {
    $ext = $_.Extension.ToLower()
    $name = $_.Name.ToLower()
    ($supported -contains $ext) -and ($ignore -notcontains $name)
}

$books = @()
$idx = 1

foreach ($file in $items) {
    $bytes = $file.Length
    if ($bytes -lt 1KB) {
        $formatted = "$($bytes) B"
    } elseif ($bytes -lt 1MB) {
        $formatted = "{0:N1} KB" -f ($bytes / 1KB)
    } elseif ($bytes -lt 1GB) {
        $formatted = "{0:N1} MB" -f ($bytes / 1MB)
    } else {
        $formatted = "{0:N2} GB" -f ($bytes / 1GB)
    }

    $title = $file.BaseName -replace '[_\-]+', ' '
    $title = $title -replace '\s+', ' '

    $lower = $file.Name.ToLower()
    $category = "ENGINEERING & REFERENCE"
    if ($lower -match "genai|ai|llm|neural|deep learning|transformer|pytorch|tensorflow|vision|nlp") {
        $category = "DEEP LEARNING & AI"
    } elseif ($lower -match "algo|dsa|leetcode|clrs|graph|tree|dynamic|sorting|search") {
        $category = "ALGORITHMS & DSA"
    } elseif ($lower -match "system|design|distribut|architect|scale|concurrency|microservice") {
        $category = "SYSTEM DESIGN"
    } elseif ($lower -match "sql|pandas|data|database|postgres|mysql|nosql|redis|query") {
        $category = "DATABASE & SQL"
    } elseif ($lower -match "python|javascript|typescript|c\+\+|cpp|rust|golang|java|code") {
        $category = "PROGRAMMING LANGUAGES"
    } elseif ($lower -match "math|calculus|linear algebra|statistics|probability|discrete") {
        $category = "MATHEMATICS & STATS"
    }

    $cleanStem = ($file.BaseName -replace '[^a-zA-Z0-9]', '_')
    if ($cleanStem.Length -gt 24) { $cleanStem = $cleanStem.Substring(0, 24) }

    $bookObj = [PSCustomObject]@{
        id = "book_{0:D3}_{1}" -f $idx, $cleanStem
        filename = $file.Name
        title = $title.Trim()
        format = $file.Extension.TrimStart('.').ToUpper()
        sizeBytes = $bytes
        sizeFormatted = $formatted
        category = $category
        dateModified = $file.LastWriteTime.ToString("yyyy-MM-dd")
    }
    $books += $bookObj
    $idx++
}

$json = $books | ConvertTo-Json -Depth 4
$outContent = "// ==========================================================================`n" +
              "// BOOKS CATALOG DATASET`n" +
              "// Automatically generated from oa-tracker/books/ directory.`n" +
              "// Strict Policy: NO EMOJIS in dataset.`n" +
              "// ==========================================================================`n`n" +
              "var BOOKS_CATALOG = $json;`n`n" +
              "if (typeof module !== 'undefined' && module.exports) {`n" +
              "  module.exports = BOOKS_CATALOG;`n" +
              "}`n"

$outFile = Join-Path $scriptDir "books_data.js"
Set-Content -Path $outFile -Value $outContent -Encoding UTF8

Write-Host "Books scanned: $($books.Count)"
