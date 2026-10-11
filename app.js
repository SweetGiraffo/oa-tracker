// ==========================================================================
// OA PROTOCOL // 8-BIT ARCADE ENGINE
// Strict Policy: NO EMOJIS ANYWHERE in code or rendered text.
// ==========================================================================

const STORAGE_KEY = "oa_arcade_tracker_state_v1";

// Default State
let appState = {
  activeDay: 10, // Defaults to Oct 10
  completedContests: {}, // contestId -> true
  missedContests: {},    // contestId -> true
  questionStates: {},    // questionId -> "unsolved" | "solved" | "upsolve"
  sqlQuestionStates: {}, // sqlQuestionId -> "unsolved" | "solved" | "upsolve"
  bookReadingStates: {}, // bookId -> "unread" | "reading" | "completed"
  soundEnabled: true,
  theme: "default"
};
window.appState = appState;

// ==========================================================================
// 8-BIT SOUND SYNTHESIZER (Web Audio API - Zero External Files)
// ==========================================================================
class PixelAudio {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playBeep(freq = 440, type = "square", duration = 0.08, vol = 0.1) {
    if (!appState.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback without error
    }
  }

  click() {
    this.playBeep(880, "square", 0.04, 0.08);
  }

  unlock() {
    if (!appState.soundEnabled) return;
    try {
      this.init();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playBeep(freq, "square", 0.12, 0.12);
        }, idx * 70);
      });
    } catch(e) {}
  }

  victory() {
    if (!appState.soundEnabled) return;
    try {
      this.init();
      const fanfare = [392.0, 523.25, 659.25, 783.99, 1046.50];
      fanfare.forEach((freq, idx) => {
        setTimeout(() => {
          this.playBeep(freq, "triangle", 0.18, 0.15);
        }, idx * 90);
      });
    } catch(e) {}
  }

  missedAlert() {
    this.playBeep(180, "sawtooth", 0.25, 0.15);
  }
}

const sfx = new PixelAudio();
window.sfx = sfx;

// ==========================================================================
// STATE MANAGEMENT & PERSISTENCE
// ==========================================================================
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.customBooks;
      appState = Object.assign({}, appState, parsed);
      delete appState.customBooks;

      // Automatically prune reading statuses for books that were deleted from books/
      if (appState.bookReadingStates && window.BOOKS_CATALOG) {
        const activeIds = new Set(window.BOOKS_CATALOG.map(b => b.id));
        Object.keys(appState.bookReadingStates).forEach(id => {
          if (!activeIds.has(id)) {
            delete appState.bookReadingStates[id];
          }
        });
      }
    } else {
      // Initial state sync with system date
      syncWithSystemDate(false);
    }
  } catch (err) {
    console.warn("Storage load fallback:", err);
  }
  recomputeMissedStatus();
}

function saveState() {
  try {
    delete appState.customBooks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.warn("Storage save error:", err);
  }
}

// Check calendar dates to flag past uncompleted OAs as missed
function recomputeMissedStatus() {
  CONTEST_SCHEDULE.forEach(c => {
    // If date has passed before activeDay and is not completed
    if (c.dayNum < appState.activeDay && !appState.completedContests[c.id]) {
      appState.missedContests[c.id] = true;
    }
  });
}

function syncWithSystemDate(shouldNotify = true) {
  const now = new Date();
  const currentMonth = now.getMonth(); // 9 is October (0-indexed)
  const currentDate = now.getDate();

  // If in October, bind to current day (bounded between 10 and 31)
  if (currentMonth === 9 && currentDate >= 10 && currentDate <= 31) {
    appState.activeDay = currentDate;
  } else if (currentMonth === 9 && currentDate > 31) {
    appState.activeDay = 31;
  } else {
    // Default to Day 1 (Oct 10) if outside the window
    appState.activeDay = 10;
  }
  recomputeMissedStatus();
  saveState();
  if (shouldNotify) {
    renderAll();
    sfx.click();
  }
}

// ==========================================================================
// BUSINESS LOGIC & CONTEST ACTIONS
// ==========================================================================
function markContestComplete(contestId) {
  appState.completedContests[contestId] = true;
  delete appState.missedContests[contestId];
  saveState();
  sfx.victory();
  renderAll();
}

function markContestMissed(contestId) {
  delete appState.completedContests[contestId];
  appState.missedContests[contestId] = true;
  saveState();
  sfx.missedAlert();
  renderAll();
}

function resetContestStatus(contestId) {
  delete appState.completedContests[contestId];
  // If date is before active day, it returns to missed, otherwise pending
  const c = CONTEST_SCHEDULE.find(item => item.id === contestId);
  if (c && c.dayNum < appState.activeDay) {
    appState.missedContests[contestId] = true;
  } else {
    delete appState.missedContests[contestId];
  }
  saveState();
  sfx.click();
  renderAll();
}

function toggleQuestionStatus(qId) {
  const current = appState.questionStates[qId] || "unsolved";
  let next = "unsolved";
  if (current === "unsolved") next = "solved";
  else if (current === "solved") next = "upsolve";
  else next = "unsolved";

  appState.questionStates[qId] = next;
  saveState();
  sfx.click();
  renderAll();
}

function toggleSqlQuestionStatus(qId) {
  if (!appState.sqlQuestionStates) appState.sqlQuestionStates = {};
  const current = appState.sqlQuestionStates[qId] || "unsolved";
  let next = "unsolved";
  if (current === "unsolved") next = "solved";
  else if (current === "solved") next = "upsolve";
  else next = "unsolved";

  appState.sqlQuestionStates[qId] = next;
  saveState();
  sfx.click();
  renderAll();
}

window.markContestComplete = markContestComplete;
window.markContestMissed = markContestMissed;
window.resetContestStatus = resetContestStatus;
window.toggleQuestionStatus = toggleQuestionStatus;
window.toggleSqlQuestionStatus = toggleSqlQuestionStatus;

// ==========================================================================
// RENDERERS
// ==========================================================================

// 1. HUD & Stats
function renderHUD() {
  const completedCount = Object.keys(appState.completedContests).length;
  const missedCount = Object.keys(appState.missedContests).filter(id => !appState.completedContests[id]).length;
  
  // Total unique topics revealed
  const uniqueTopicsSet = new Set();
  CONTEST_SCHEDULE.forEach(c => {
    if (appState.completedContests[c.id]) {
      c.topics.forEach(t => uniqueTopicsSet.add(t));
    }
  });

  const total = CONTEST_SCHEDULE.length;
  const pct = Math.round((completedCount / total) * 100);

  // HUD Elements
  const hudCurrentDate = document.getElementById("hudCurrentDate");
  const expBarFill = document.getElementById("expBarFill");
  const playerLevelText = document.getElementById("playerLevelText");
  const playerProgressText = document.getElementById("playerProgressText");
  const hudCompletedCount = document.getElementById("hudCompletedCount");
  const hudMissedCount = document.getElementById("hudMissedCount");
  const hudTopicsCount = document.getElementById("hudTopicsCount");

  const tabBadgeToday = document.getElementById("tabBadgeToday");
  const tabBadgeMissed = document.getElementById("tabBadgeMissed");
  const tabBadgeTopics = document.getElementById("tabBadgeTopics");
  const tabBadgeVault = document.getElementById("tabBadgeVault");

  if (hudCurrentDate) hudCurrentDate.textContent = `OCT ${appState.activeDay}`;
  if (expBarFill) expBarFill.style.width = `${pct}%`;
  
  // Player Level calculation
  let rank = "APPRENTICE";
  if (completedCount >= 5) rank = "SOLVER";
  if (completedCount >= 10) rank = "SPECIALIST";
  if (completedCount >= 16) rank = "MASTER";
  if (completedCount === 22) rank = "GRANDMASTER";

  if (playerLevelText) playerLevelText.textContent = `RANK: ${rank} [LVL ${completedCount}]`;
  if (playerProgressText) playerProgressText.textContent = `${completedCount} / ${total} [${pct}%]`;

  if (hudCompletedCount) hudCompletedCount.textContent = `[DONE: ${completedCount}]`;
  if (hudMissedCount) hudMissedCount.textContent = `[MISSED: ${missedCount}]`;
  if (hudTopicsCount) hudTopicsCount.textContent = `[TOPICS: ${uniqueTopicsSet.size}]`;

  // Tab badges
  if (tabBadgeMissed) tabBadgeMissed.textContent = missedCount;
  if (tabBadgeTopics) tabBadgeTopics.textContent = uniqueTopicsSet.size;

  // Total unlocked questions count
  let unlockedQuestionsCount = 0;
  CONTEST_SCHEDULE.forEach(c => {
    if (appState.completedContests[c.id]) {
      unlockedQuestionsCount += c.questions.length;
    }
  });
  if (tabBadgeVault) tabBadgeVault.textContent = unlockedQuestionsCount;

  // SQL & Pandas tab badge
  const tabBadgeSql = document.getElementById("tabBadgeSql");
  if (tabBadgeSql) {
    const sqlTotal = 25;
    const sqlSolved = Object.values(appState.sqlQuestionStates || {}).filter(s => s === "solved").length;
    tabBadgeSql.textContent = `${sqlSolved}/${sqlTotal}`;
  }
}

// 2. Day Dispatcher dropdown
function renderDaySelector() {
  const select = document.getElementById("dateSelect");
  if (!select) return;

  select.innerHTML = "";
  CONTEST_SCHEDULE.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.dayNum;
    const isDone = appState.completedContests[c.id] ? "[DONE] " : "";
    const isMissed = appState.missedContests[c.id] ? "[MISSED] " : "";
    opt.textContent = `${c.date} :: ${isDone}${isMissed}${c.title}`;
    if (c.dayNum === appState.activeDay) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// 3. Active Hero Mission Card
function renderTodayHeroCard() {
  const container = document.getElementById("todayHeroCard");
  if (!container) return;

  const currentContest = CONTEST_SCHEDULE.find(c => c.dayNum === appState.activeDay) || CONTEST_SCHEDULE[0];
  const isDone = !!appState.completedContests[currentContest.id];
  const isMissed = !!appState.missedContests[currentContest.id] && !isDone;

  let statusTagClass = "";
  let statusText = "[ACTIVE OA TARGET]";
  if (isDone) {
    statusTagClass = "tag-done";
    statusText = "[OA MISSION CLEARED]";
  } else if (isMissed) {
    statusTagClass = "tag-missed";
    statusText = "[OA MARKED MISSED - READY TO SOLVE]";
  }

  // Topics presentation
  let topicsHtml = "";
  if (!isDone) {
    // Hidden / Classified
    topicsHtml = `
      <div class="classified-lock-screen">
        <span class="lock-sign">[CLASSIFIED - TOPICS LOCKED]</span>
        <div class="glitch-code-sample">###-###-### [ENCRYPTED]</div>
        <p class="lock-notice">
          OA Primary Patterns are hidden during assessment mode to simulate real interview and OA conditions.
          Complete the virtual contest to unlock the pattern tags and add them to your Topics Covered list!
        </p>
      </div>
    `;
  } else {
    // Revealed
    topicsHtml = `
      <div class="revealed-topics-area">
        ${currentContest.topics.map(t => `
          <div class="pixel-topic-pill pill-active">
            <span>[+]</span>
            <span>${t.toUpperCase()}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Questions presentation (Visible only if Completed)
  let questionsHtml = "";
  if (isDone) {
    questionsHtml = `
      <div class="unlocked-questions-panel">
        <div class="panel-title-bar">
          <span>&gt;&gt; CONTEST PROBLEM SET [ALL 4 QUESTIONS UNLOCKED]</span>
          <span class="hud-label">CLICK STATUS TO TOGGLE PRACTICE STATE</span>
        </div>
        <div class="questions-pixel-grid">
          ${currentContest.questions.map(q => {
            const qState = appState.questionStates[q.id] || "unsolved";
            let statusBtnClass = "";
            let statusLabel = "[UNSOLVED]";
            if (qState === "solved") {
              statusBtnClass = "solved";
              statusLabel = "[SOLVED]";
            } else if (qState === "upsolve") {
              statusBtnClass = "upsolve";
              statusLabel = "[UPSOLVE LATER]";
            }

            return `
              <div class="question-pixel-card">
                <div class="q-top-row">
                  <span class="q-badge">${q.num} - #${q.id}</span>
                  <span class="diff-badge ${q.difficulty}">[${q.difficulty.toUpperCase()}]</span>
                </div>
                <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="q-title-link">
                  &gt; ${q.title}
                </a>
                <div class="q-actions-row">
                  <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-dark">
                    [OPEN PROBLEM]
                  </a>
                  <button class="q-solve-status-btn ${statusBtnClass}" onclick="toggleQuestionStatus('${q.id}')">
                    ${statusLabel}
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="mission-header">
      <div>
        <span class="mission-tag ${statusTagClass}">${statusText}</span>
        <h2 class="mission-title">${currentContest.title.toUpperCase()}</h2>
      </div>
      <div style="text-align: right;">
        <span class="hud-label">ASSIGNED DATE</span>
        <div class="mission-date-label">${currentContest.date.toUpperCase()}, 2026</div>
      </div>
    </div>

    <div class="mission-body-grid">
      <div class="mission-meta-box">
        <div class="meta-row">
          <span class="meta-key">CONTEST FORMAT</span>
          <span class="meta-val">LEETCODE VIRTUAL CONTEST</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">DURATION</span>
          <span class="meta-val">90 MINUTES - 4 PROBLEMS</span>
        </div>
        <div class="meta-row">
          <span class="meta-key">ASSESSMENT LINK</span>
          <span class="meta-val">
            <a href="${currentContest.contestUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--text-cyan); text-decoration: underline;">
              ${currentContest.contestUrl}
            </a>
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-key">STATUS</span>
          <span class="meta-val" style="color: ${isDone ? 'var(--text-green)' : (isMissed ? 'var(--text-red)' : 'var(--text-yellow)')}">
            ${isDone ? '[COMPLETED]' : (isMissed ? '[MISSED BACKLOG]' : '[PENDING TODAY]')}
          </span>
        </div>
      </div>

      <div class="topic-classification-box">
        <div class="topic-box-title">
          <span>&gt;&gt; PRIMARY OA PATTERNS:</span>
          <span class="hud-label">${isDone ? '[UNLOCKED &amp; CATALOGED]' : '[HIDDEN DURING OA]'}</span>
        </div>
        ${topicsHtml}
      </div>
    </div>

    <div class="mission-action-footer">
      <a href="${currentContest.contestUrl}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-cyan" onclick="sfx.click()">
        [LAUNCH VIRTUAL CONTEST &gt;&gt;&gt;]
      </a>

      ${!isDone ? `
        <button class="pixel-btn btn-green" onclick="markContestComplete('${currentContest.id}')">
          [COMPLETE OA - UNLOCK TOPICS]
        </button>
        <button class="pixel-btn btn-red" onclick="markContestMissed('${currentContest.id}')">
          [MARK AS MISSED]
        </button>
      ` : `
        <button class="pixel-btn btn-dark" onclick="resetContestStatus('${currentContest.id}')">
          [REVERT / RESET STATUS]
        </button>
      `}
    </div>

    ${questionsHtml}
  `;
}

// 4. Missed Contests View
function renderMissedView() {
  const container = document.getElementById("missedListContainer");
  const banner = document.getElementById("missedAlertBanner");
  if (!container) return;

  const missedList = CONTEST_SCHEDULE.filter(c => appState.missedContests[c.id] && !appState.completedContests[c.id]);

  if (missedList.length === 0) {
    if (banner) banner.style.display = "none";
    container.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[NO MISSED CONTESTS - ALL UP TO DATE]</div>
        <p class="empty-sub">Outstanding performance! Every scheduled OA up to this point is completed or on track.</p>
      </div>
    `;
    return;
  }

  if (banner) banner.style.display = "flex";

  container.innerHTML = missedList.map(c => `
    <div class="contest-item-card state-missed">
      <div class="item-top-row">
        <span class="date-stamp">${c.date.toUpperCase()}</span>
        <span class="status-badge badge-missed">[MISSED]</span>
      </div>

      <div>
        <h3 class="contest-card-title">${c.title.toUpperCase()}</h3>
      </div>

      <div class="contest-card-topics">
        <span class="topics-censored-text">[PATTERNS LOCKED UNTIL COMPLETION]</span>
      </div>

      <div class="item-bottom-actions">
        <a href="${c.contestUrl}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-cyan">
          [LAUNCH OA &gt;&gt;]
        </a>
        <button class="pixel-btn btn-sm btn-green" onclick="markContestComplete('${c.id}')">
          [COMPLETE NOW]
        </button>
      </div>
    </div>
  `).join("");
}

// 5. Topics Covered View
function renderTopicsView() {
  const gridContainer = document.getElementById("topicsGridContainer");
  const statUniqueTopics = document.getElementById("statUniqueTopics");
  const statContestsCleared = document.getElementById("statContestsCleared");
  const statTotalMasteryPts = document.getElementById("statTotalMasteryPts");

  // Collect topics from completed contests only
  const topicMap = {}; // topic -> [contestTitle1, contestTitle2, ...]
  let completedCount = 0;

  CONTEST_SCHEDULE.forEach(c => {
    if (appState.completedContests[c.id]) {
      completedCount++;
      c.topics.forEach(t => {
        if (!topicMap[t]) topicMap[t] = [];
        topicMap[t].push(c.title);
      });
    }
  });

  const uniqueTopicKeys = Object.keys(topicMap).sort();
  const totalMasteryBadges = Object.values(topicMap).reduce((acc, curr) => acc + curr.length, 0);

  if (statUniqueTopics) statUniqueTopics.textContent = uniqueTopicKeys.length;
  if (statContestsCleared) statContestsCleared.textContent = completedCount;
  if (statTotalMasteryPts) statTotalMasteryPts.textContent = totalMasteryBadges;

  if (uniqueTopicKeys.length === 0) {
    gridContainer.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[NO TOPICS UNLOCKED YET]</div>
        <p class="empty-sub">Complete your daily virtual OA contests to reveal patterns and add them to this directory!</p>
      </div>
    `;
    return;
  }

  gridContainer.innerHTML = uniqueTopicKeys.map(t => {
    const contests = topicMap[t];
    return `
      <div class="topic-mastery-card">
        <div class="tm-title">&gt; ${t.toUpperCase()}</div>
        <div class="tm-count-badge">[ENCOUNTERED: ${contests.length}x]</div>
        <div class="tm-sources-list">
          <div>CONTEST OCCURRENCES:</div>
          ${contests.map(c => `<div>* ${c}</div>`).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// 6. Question Vault View
let activeQFilter = "ALL";

function renderQuestionVault() {
  const container = document.getElementById("vaultQuestionsContainer");
  if (!container) return;

  // Gather questions from completed contests
  const unlockedQuestions = [];
  CONTEST_SCHEDULE.forEach(c => {
    if (appState.completedContests[c.id]) {
      c.questions.forEach(q => {
        unlockedQuestions.push({
          ...q,
          contestTitle: c.title,
          contestDate: c.date
        });
      });
    }
  });

  if (unlockedQuestions.length === 0) {
    container.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[VAULT IS CURRENTLY EMPTY]</div>
        <p class="empty-sub">Complete OA contests to unlock their entire 4-question sets for post-contest upsolving!</p>
      </div>
    `;
    return;
  }

  const filtered = unlockedQuestions.filter(q => {
    const qState = appState.questionStates[q.id] || "unsolved";
    if (activeQFilter === "ALL") return true;
    if (activeQFilter === "Easy" || activeQFilter === "Medium" || activeQFilter === "Hard") {
      return q.difficulty === activeQFilter;
    }
    if (activeQFilter === "unsolved") return qState === "unsolved";
    if (activeQFilter === "solved") return qState === "solved";
    if (activeQFilter === "upsolve") return qState === "upsolve";
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[NO QUESTIONS MATCH FILTER: ${activeQFilter.toUpperCase()}]</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(q => {
    const qState = appState.questionStates[q.id] || "unsolved";
    let statusBtnClass = "";
    let statusLabel = "[UNSOLVED]";
    if (qState === "solved") {
      statusBtnClass = "solved";
      statusLabel = "[SOLVED]";
    } else if (qState === "upsolve") {
      statusBtnClass = "upsolve";
      statusLabel = "[UPSOLVE LATER]";
    }

    return `
      <div class="question-pixel-card">
        <div class="q-top-row">
          <span class="q-badge">${q.num} - ${q.contestDate}</span>
          <span class="diff-badge ${q.difficulty}">[${q.difficulty.toUpperCase()}]</span>
        </div>
        <div>
          <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="q-title-link">
            &gt; ${q.title}
          </a>
          <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
            SOURCE: ${q.contestTitle}
          </div>
        </div>
        <div class="q-actions-row">
          <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-dark">
            [OPEN LEETCODE]
          </a>
          <button class="q-solve-status-btn ${statusBtnClass}" onclick="toggleQuestionStatus('${q.id}')">
            ${statusLabel}
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// 7. Full Roadmap View
let activeRoadmapFilter = "ALL";

function renderRoadmap() {
  const container = document.getElementById("roadmapGridContainer");
  if (!container) return;

  const filtered = CONTEST_SCHEDULE.filter(c => {
    const isDone = !!appState.completedContests[c.id];
    const isMissed = !!appState.missedContests[c.id] && !isDone;

    if (activeRoadmapFilter === "ALL") return true;
    if (activeRoadmapFilter === "COMPLETED") return isDone;
    if (activeRoadmapFilter === "MISSED") return isMissed;
    if (activeRoadmapFilter === "PENDING") return !isDone && !isMissed;
    return true;
  });

  container.innerHTML = filtered.map(c => {
    const isDone = !!appState.completedContests[c.id];
    const isMissed = !!appState.missedContests[c.id] && !isDone;
    const isToday = c.dayNum === appState.activeDay;

    let cardClass = "";
    let badgeClass = "badge-pending";
    let badgeText = "[PENDING]";

    if (isDone) {
      cardClass = "state-completed";
      badgeClass = "badge-completed";
      badgeText = "[COMPLETED]";
    } else if (isMissed) {
      cardClass = "state-missed";
      badgeClass = "badge-missed";
      badgeText = "[MISSED]";
    } else if (isToday) {
      cardClass = "state-today";
      badgeClass = "badge-today";
      badgeText = "[TODAY]";
    }

    return `
      <div class="contest-item-card ${cardClass}">
        <div class="item-top-row">
          <span class="date-stamp">${c.date.toUpperCase()}</span>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </div>

        <div>
          <h3 class="contest-card-title">${c.title.toUpperCase()}</h3>
        </div>

        <div class="contest-card-topics">
          ${isDone ? `
            <div class="topics-revealed-tags">
              ${c.topics.map(t => `<span class="mini-topic-tag">[+] ${t.toUpperCase()}</span>`).join("")}
            </div>
          ` : `
            <span class="topics-censored-text">[PATTERNS HIDDEN]</span>
          `}
        </div>

        <div class="item-bottom-actions">
          <button class="pixel-btn btn-sm btn-cyan" onclick="selectDayAndJump(${c.dayNum})">
            [FOCUS DAY]
          </button>
          <a href="${c.contestUrl}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-dark">
            [LINK &gt;&gt;]
          </a>
        </div>
      </div>
    `;
  }).join("");
}

// 8. SQL & Pandas Mastery View
let activeSqlFilter = "ALL";

function renderSqlModules() {
  const container = document.getElementById("sqlModulesContainer");
  if (!container || !window.SQL_PANDAS_MODULES) return;

  const modules = window.SQL_PANDAS_MODULES;
  let totalVisible = 0;

  const renderedModulesHtml = modules.map(mod => {
    const filteredProblems = mod.problems.filter(p => {
      const pState = (appState.sqlQuestionStates && appState.sqlQuestionStates[p.id]) || "unsolved";
      if (activeSqlFilter === "ALL") return true;
      if (activeSqlFilter === "Easy" || activeSqlFilter === "Medium" || activeSqlFilter === "Hard") {
        return p.difficulty === activeSqlFilter;
      }
      if (activeSqlFilter === "unsolved") return pState === "unsolved";
      if (activeSqlFilter === "solved") return pState === "solved";
      if (activeSqlFilter === "upsolve") return pState === "upsolve";
      return true;
    });

    if (filteredProblems.length === 0) return "";
    totalVisible += filteredProblems.length;

    const modSolvedCount = mod.problems.filter(p => (appState.sqlQuestionStates && appState.sqlQuestionStates[p.id]) === "solved").length;

    return `
      <div class="sql-module-card">
        <div class="sql-module-header">
          <div class="sql-module-top-row">
            <span class="sql-module-badge">MODULE ${mod.moduleNumber}</span>
            <span class="hud-label" style="color: var(--text-cyan); font-size: 10px;">
              PROGRESS: ${modSolvedCount} / ${mod.problems.length} SOLVED
            </span>
          </div>
          <h3 class="sql-module-title">&gt; ${mod.title.toUpperCase()}</h3>
          <div class="sql-module-focus">&gt; ${mod.focus}</div>
        </div>

        <div class="questions-pixel-grid">
          ${filteredProblems.map(p => {
            const pState = (appState.sqlQuestionStates && appState.sqlQuestionStates[p.id]) || "unsolved";
            let statusBtnClass = "";
            let statusLabel = "[UNSOLVED]";
            if (pState === "solved") {
              statusBtnClass = "solved";
              statusLabel = "[SOLVED]";
            } else if (pState === "upsolve") {
              statusBtnClass = "upsolve";
              statusLabel = "[REVISIT]";
            }

            return `
              <div class="question-pixel-card">
                <div class="q-top-row">
                  <span class="q-badge">#${p.id}</span>
                  <span class="diff-badge ${p.difficulty}">[${p.difficulty.toUpperCase()}]</span>
                </div>
                <div>
                  <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="q-title-link">
                    &gt; ${p.title}
                  </a>
                  <div class="sql-tech-note" style="margin-top: 8px;">
                    KEY TECHNIQUE: ${p.technique}
                  </div>
                </div>
                <div class="q-actions-row">
                  <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-dark">
                    [OPEN LEETCODE]
                  </a>
                  <button class="q-solve-status-btn ${statusBtnClass}" onclick="toggleSqlQuestionStatus('${p.id}')">
                    ${statusLabel}
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).filter(Boolean).join("");

  if (totalVisible === 0) {
    container.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[NO PROBLEMS MATCH FILTER: ${activeSqlFilter.toUpperCase()}]</div>
      </div>
    `;
  } else {
    container.innerHTML = renderedModulesHtml;
  }
}

// ==========================================================================
// BOOKS & RESOURCE ARCHIVE LOGIC
// Source: oa-tracker/books/ folder
// ==========================================================================
let activeBookFilter = "ALL";
let booksSearchQuery = "";
let booksSortOrder = "title_asc";

function getAllBooks() {
  const catalog = window.BOOKS_CATALOG || [];
  return catalog.filter(b => (b.filename || "").toLowerCase().endsWith(".pdf"));
}

function toggleBookReadingStatus(bookId) {
  if (!appState.bookReadingStates) appState.bookReadingStates = {};
  const current = appState.bookReadingStates[bookId] || "unread";
  let next = "unread";
  if (current === "unread") {
    next = "reading";
    sfx.click();
  } else if (current === "reading") {
    next = "completed";
    sfx.victory();
  } else {
    next = "unread";
    sfx.click();
  }
  appState.bookReadingStates[bookId] = next;
  saveState();
  renderBooksView();
}
window.toggleBookReadingStatus = toggleBookReadingStatus;

function renderBooksView() {
  const container = document.getElementById("booksGridContainer");
  if (!container) return;

  const allBooks = getAllBooks();
  if (!appState.bookReadingStates) appState.bookReadingStates = {};

  // Compute stats
  let doneCount = 0;
  let readingCount = 0;
  let totalBytes = 0;

  allBooks.forEach(b => {
    const st = appState.bookReadingStates[b.id] || "unread";
    if (st === "completed") doneCount++;
    else if (st === "reading") readingCount++;
    totalBytes += (b.sizeBytes || 0);
  });

  const totalCount = allBooks.length;
  const donePercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  let formattedTotalSize = "0 MB";
  if (totalBytes < 1024 * 1024) formattedTotalSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  else if (totalBytes < 1024 * 1024 * 1024) formattedTotalSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  else formattedTotalSize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  // Update DOM badges
  const tabBadgeBooks = document.getElementById("tabBadgeBooks");
  if (tabBadgeBooks) tabBadgeBooks.textContent = `${doneCount}/${totalCount}`;

  const booksExpBarFill = document.getElementById("booksExpBarFill");
  if (booksExpBarFill) booksExpBarFill.style.width = `${donePercent}%`;

  const booksDoneBadge = document.getElementById("booksDoneBadge");
  if (booksDoneBadge) booksDoneBadge.textContent = `READ: ${doneCount}`;

  const booksReadingBadge = document.getElementById("booksReadingBadge");
  if (booksReadingBadge) booksReadingBadge.textContent = `READING: ${readingCount}`;

  const booksTotalBadge = document.getElementById("booksTotalBadge");
  if (booksTotalBadge) booksTotalBadge.textContent = `TOTAL: ${totalCount}`;

  const booksSizeBadge = document.getElementById("booksSizeBadge");
  if (booksSizeBadge) booksSizeBadge.textContent = `SIZE: ${formattedTotalSize}`;

  const filterAllCount = document.getElementById("filterAllCount");
  if (filterAllCount) filterAllCount.textContent = totalCount;

  // Filter books
  let filtered = allBooks.filter(book => {
    const st = appState.bookReadingStates[book.id] || "unread";

    if (activeBookFilter === "ALL") {
      // pass
    } else if (activeBookFilter === "completed") {
      if (st !== "completed") return false;
    } else if (activeBookFilter === "reading") {
      if (st !== "reading") return false;
    } else if (activeBookFilter === "unread") {
      if (st !== "unread") return false;
    }

    if (booksSearchQuery) {
      const q = booksSearchQuery.toLowerCase();
      const inTitle = (book.title || "").toLowerCase().includes(q);
      const inFilename = (book.filename || "").toLowerCase().includes(q);
      const inCategory = (book.category || "").toLowerCase().includes(q);
      if (!inTitle && !inFilename && !inCategory) return false;
    }

    return true;
  });

  // Sort books
  filtered.sort((a, b) => {
    if (booksSortOrder === "title_asc") {
      return (a.title || "").localeCompare(b.title || "");
    } else if (booksSortOrder === "size_desc") {
      return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    } else if (booksSortOrder === "date_desc") {
      return (b.dateModified || "").localeCompare(a.dateModified || "");
    } else if (booksSortOrder === "status") {
      const order = { reading: 1, completed: 2, unread: 3 };
      const stA = order[appState.bookReadingStates[a.id] || "unread"] || 3;
      const stB = order[appState.bookReadingStates[b.id] || "unread"] || 3;
      return stA - stB;
    }
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="missed-empty-state" style="grid-column: 1 / -1;">
        <div class="empty-title">[NO BOOKS MATCH CURRENT SELECTION]</div>
        <p class="empty-sub">Try selecting [ALL] or clearing your search query.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(book => {
    const status = appState.bookReadingStates[book.id] || "unread";
    let statusClass = "unread";
    let statusLabel = "[UNREAD]";
    if (status === "reading") {
      statusClass = "reading";
      statusLabel = "[READING]";
    } else if (status === "completed") {
      statusClass = "completed";
      statusLabel = "[COMPLETED]";
    }

    const downloadHref = `books/${encodeURIComponent(book.filename)}`;

    return `
      <div class="book-pixel-card state-${status}">
        <div class="book-card-top">
          <div class="book-badge-group">
            <span class="book-format-badge fmt-pdf">[PDF]</span>
            <span class="book-category-badge">${book.category || 'ENGINEERING'}</span>
          </div>
          <span style="font-family: var(--font-pixel); font-size: 8px; color: var(--text-dim);">
            ${book.dateModified || '2026-10-11'}
          </span>
        </div>

        <div class="book-card-body">
          <div class="book-title">${book.title}</div>
          <div class="book-meta-sub">
            <span class="book-filename">books/${book.filename}</span>
            <span class="hud-val-badge accent-yellow" style="font-size: 9px; padding: 2px 6px;">${book.sizeFormatted}</span>
          </div>
        </div>

        <div class="book-card-actions">
          <a href="${downloadHref}" download="${book.filename}" target="_blank" rel="noopener noreferrer" class="pixel-btn btn-sm btn-cyan" onclick="sfx.click()">
            [DOWNLOAD / OPEN]
          </a>
          <button class="book-status-btn ${statusClass}" onclick="toggleBookReadingStatus('${book.id}')">
            ${statusLabel}
          </button>
        </div>
      </div>
    `;
  }).join("");
}
window.renderBooksView = renderBooksView;

function selectDayAndJump(dayNum) {
  appState.activeDay = dayNum;
  recomputeMissedStatus();
  saveState();
  sfx.click();

  // Switch to Today tab
  switchTab("tab-today");
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.toggle("active", sec.id === tabId);
  });
  sfx.click();
  renderAll();
}
window.selectDayAndJump = selectDayAndJump;
window.switchTab = switchTab;


// Render Master Coordinator
function renderAll() {
  renderHUD();
  renderDaySelector();
  renderTodayHeroCard();
  renderMissedView();
  renderTopicsView();
  renderQuestionVault();
  renderRoadmap();
  renderSqlModules();
  renderBooksView();
}

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================
function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Sound toggle
  const btnToggleSound = document.getElementById("btnToggleSound");
  if (btnToggleSound) {
    btnToggleSound.addEventListener("click", () => {
      appState.soundEnabled = !appState.soundEnabled;
      btnToggleSound.textContent = appState.soundEnabled ? "[AUDIO: ON]" : "[AUDIO: OFF]";
      saveState();
      sfx.click();
    });
  }

  // Reset progress
  const btnResetAll = document.getElementById("btnResetAll");
  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      if (confirm("CONFIRMATION: Reset all completed OAs, topics, and question progress?")) {
        appState.completedContests = {};
        appState.missedContests = {};
        appState.questionStates = {};
        appState.sqlQuestionStates = {};
        appState.bookReadingStates = {};
        recomputeMissedStatus();
        saveState();
        sfx.missedAlert();
        renderAll();
      }
    });
  }

  // Prev / Next day quick buttons
  const btnQuickPrevDay = document.getElementById("btnQuickPrevDay");
  const btnQuickNextDay = document.getElementById("btnQuickNextDay");
  if (btnQuickPrevDay) {
    btnQuickPrevDay.addEventListener("click", () => {
      if (appState.activeDay > 10) {
        appState.activeDay--;
        recomputeMissedStatus();
        saveState();
        sfx.click();
        renderAll();
      }
    });
  }
  if (btnQuickNextDay) {
    btnQuickNextDay.addEventListener("click", () => {
      if (appState.activeDay < 31) {
        appState.activeDay++;
        recomputeMissedStatus();
        saveState();
        sfx.click();
        renderAll();
      }
    });
  }

  // Date select dropdown
  const dateSelect = document.getElementById("dateSelect");
  if (dateSelect) {
    dateSelect.addEventListener("change", (e) => {
      appState.activeDay = parseInt(e.target.value, 10);
      recomputeMissedStatus();
      saveState();
      sfx.click();
      renderAll();
    });
  }

  // Sync real date button
  const btnSyncRealToday = document.getElementById("btnSyncRealToday");
  if (btnSyncRealToday) {
    btnSyncRealToday.addEventListener("click", () => {
      syncWithSystemDate(true);
    });
  }

  // Question vault filters
  document.querySelectorAll("[data-qfilter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-qfilter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeQFilter = btn.dataset.qfilter;
      sfx.click();
      renderQuestionVault();
    });
  });

  // Roadmap filters
  document.querySelectorAll("[data-roadmap-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-roadmap-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRoadmapFilter = btn.dataset.roadmapFilter;
      sfx.click();
      renderRoadmap();
    });
  });

  // SQL & Pandas filters
  document.querySelectorAll("[data-sql-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-sql-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeSqlFilter = btn.dataset.sqlFilter;
      sfx.click();
      renderSqlModules();
    });
  });

  // Modal close
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const pixelModal = document.getElementById("pixelModal");
  if (modalCloseBtn && pixelModal) {
    modalCloseBtn.addEventListener("click", () => {
      pixelModal.classList.remove("open");
      sfx.click();
    });
    pixelModal.addEventListener("click", (e) => {
      if (e.target === pixelModal) {
        pixelModal.classList.remove("open");
        sfx.click();
      }
    });
  }

  // Books Filter Buttons
  document.querySelectorAll("[data-book-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-book-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeBookFilter = btn.dataset.bookFilter;
      sfx.click();
      renderBooksView();
    });
  });

  // Books Search Input
  const booksSearchInput = document.getElementById("booksSearchInput");
  if (booksSearchInput) {
    booksSearchInput.addEventListener("input", (e) => {
      booksSearchQuery = e.target.value.trim();
      renderBooksView();
    });
  }

  // Books Sort Order Select
  const booksSortSelect = document.getElementById("booksSortSelect");
  if (booksSortSelect) {
    booksSortSelect.addEventListener("change", (e) => {
      booksSortOrder = e.target.value;
      sfx.click();
      renderBooksView();
    });
  }

}

// Initial Boot
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  // Sync toggle button initial labels
  const btnToggleSound = document.getElementById("btnToggleSound");
  if (btnToggleSound) {
    btnToggleSound.textContent = appState.soundEnabled ? "[AUDIO: ON]" : "[AUDIO: OFF]";
  }

  setupEventListeners();
  renderAll();
});
