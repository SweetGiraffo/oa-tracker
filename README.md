# DSA GRINDER - APPLE DARK LEETCODE & OA TRACKER

A systematic Online Assessment (OA), SQL/DBMS mastery, and offline Books & Resource Archive designed for high-intensity technical interview preparation. Styled with an Apple Dark design system (SF Pro typography, OLED pitch-black surfaces, segmented navigation, and translucent capsule badges).

## KEY MODULES

1. **Daily OA Focus (Blind Assessment Simulation)**:
   - Structured daily virtual contest cadence (Oct 10 - Oct 31).
   - Primary OA topics remain encrypted and hidden during the assessment to emulate real test conditions.
   - Clicking `[COMPLETE OA - UNLOCK TOPICS]` unlocks the topic tags, adds them to the mastery catalogue, and reveals all 4 contest problems.

2. **Dedicated SQL, Pandas & DBMS Mastery Tab**:
   - 25 high-yield problems across 6 core interview patterns:
     - Window Functions & Ranking (Top-N per Group)
     - Gaps & Islands (Consecutive Sequences & Streaks)
     - Rolling Metrics, Retention & Date Arithmetic
     - Conditional Aggregation & Reshaping (Pivot / Melt)
     - Anti-Joins, Self-Joins & Complex CTEs
     - Pandas-Specific Mechanics Practice
   - Tracks solve states (`[UNSOLVED]`, `[SOLVED]`, `[UPSOLVE]`) with real-time status counters.

3. **Books & Study Materials Download Vault (`books/` Folder)**:
   - Offline archive of technical books, cheat sheets, and research manuals stored directly in `oa-tracker/books/`.
   - Automated catalog generation via `scan_books.ps1` / `scan_books.py` / `scan_books.bat`.
   - Direct 1-click in-browser `[DOWNLOAD / OPEN]` buttons.
   - Reading progress tracker (`[UNREAD]`, `[READING]`, `[COMPLETED]`) persisted locally.
   - Search by title or category, with multi-attribute sorting.

4. **Missed Contest Backlog & Day Dispatcher**:
   - Unfinished past contests automatically transition to the `[MISSED CONTESTS]` backlog.
   - Jump to any target date or contest directly via the day dispatcher dropdown.

5. **Question Vault**:
   - Searchable directory of all unlocked contest problems with direct LeetCode problem links and solve status tracking.

6. **Local Persistence**:
   - All progress is persisted across sessions in browser `localStorage`.

7. **Strict Policy**:
   - Zero emojis across all interface text, scripts, and stylesheets.

## LOCAL USAGE

- Double-click `run_tracker.bat` to scan the `books/` folder and launch the web tracker in your default browser.
- Or open `index.html` directly in any modern browser.
