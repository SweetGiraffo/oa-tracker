import os
import json
import re
from pathlib import Path
from datetime import datetime

# ==============================================================================
# DSA GRINDER - AUTOMATIC BOOKS & RESOURCES CATALOG SCANNER
# Strict Policy: ZERO EMOJIS in code, comments, or terminal outputs.
# ==============================================================================

SUPPORTED_EXTENSIONS = {
    ".pdf"
}

IGNORE_FILES = {
    "readme.txt", "readme.md", ".gitkeep", "desktop.ini", ".ds_store"
}

def format_file_size(size_bytes: int) -> str:
    """Returns human-readable file size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

def prettify_title(filename: str) -> str:
    """Generates a clean human-readable title from a filename."""
    stem = Path(filename).stem
    # Replace underscores, multiple spaces, and hyphens
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    # Normalize extra spaces
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned

def detect_category(filename: str) -> str:
    """Infers topic category from filename keywords."""
    lower = filename.lower()
    if any(k in lower for k in ["genai", "ai", "llm", "neural", "deep learning", "transformer", "pytorch", "tensorflow", "vision", "nlp"]):
        return "DEEP LEARNING & AI"
    if any(k in lower for k in ["algo", "dsa", "leetcode", "clrs", "graph", "tree", "dynamic", "sorting", "search"]):
        return "ALGORITHMS & DSA"
    if any(k in lower for k in ["system", "design", "distribut", "architect", "scale", "concurrency", "microservice"]):
        return "SYSTEM DESIGN"
    if any(k in lower for k in ["sql", "pandas", "data", "database", "postgres", "mysql", "nosql", "redis", "query"]):
        return "DATABASE & SQL"
    if any(k in lower for k in ["python", "javascript", "typescript", "c++", "cpp", "rust", "golang", "java", "code"]):
        return "PROGRAMMING LANGUAGES"
    if any(k in lower for k in ["math", "calculus", "linear algebra", "statistics", "probability", "discrete"]):
        return "MATHEMATICS & STATS"
    return "ENGINEERING & REFERENCE"

def scan_books_folder(base_dir: Path) -> list:
    """Scans the books/ folder and returns structured metadata for each book."""
    books_dir = base_dir / "books"
    if not books_dir.exists():
        books_dir.mkdir(parents=True, exist_ok=True)
        print(f"[INIT] Created missing books folder at: {books_dir}")

    books_list = []
    index = 1

    for entry in sorted(books_dir.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_file():
            continue
        if entry.name.lower() in IGNORE_FILES:
            continue
        suffix = entry.suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            continue

        try:
            stat = entry.stat()
            size_bytes = stat.st_size
            mod_time = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")
        except Exception:
            size_bytes = 0
            mod_time = datetime.now().strftime("%Y-%m-%d")

        book_item = {
            "id": f"book_{index:03d}_{re.sub(r'[^a-zA-Z0-9]', '_', entry.stem)[:24]}",
            "filename": entry.name,
            "title": prettify_title(entry.name),
            "format": suffix.lstrip(".").upper(),
            "sizeBytes": size_bytes,
            "sizeFormatted": format_file_size(size_bytes),
            "category": detect_category(entry.name),
            "dateModified": mod_time
        }
        books_list.append(book_item)
        index += 1

    return books_list

def main():
    base_dir = Path(__file__).resolve().parent
    books_list = scan_books_folder(base_dir)

    output_file = base_dir / "books_data.js"
    json_payload = json.dumps(books_list, indent=2)

    js_content = f"""// ==========================================================================
// BOOKS CATALOG DATASET
// Automatically generated from oa-tracker/books/ directory.
// Strict Policy: NO EMOJIS in dataset.
// ==========================================================================

var BOOKS_CATALOG = {json_payload};

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = BOOKS_CATALOG;
}}
"""

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(js_content)

    print("=" * 60)
    print("DSA GRINDER :: BOOKS & RESOURCE ARCHIVE SCANNER")
    print("=" * 60)
    print(f"Books Directory: {base_dir / 'books'}")
    print(f"Catalog File:    {output_file.name}")
    print(f"Indexed Books:   {len(books_list)}")
    for b in books_list:
        print(f"  [{b['format']}] {b['title']} ({b['sizeFormatted']}) - {b['category']}")
    print("=" * 60)
    print("SCAN COMPLETED SUCCESSFULLY.")
    print("=" * 60)

if __name__ == "__main__":
    main()
