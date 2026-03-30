// 1. DATA LOADING
let masterData = [];

function addData(source, subjectName, icon) {
    if (typeof source !== 'undefined' && Array.isArray(source)) {
        return source.map((q, index) => ({
            ...q,
            originalId: q.id,
            uniqueId: `${subjectName.replace(/\s/g, '')}_${q.id}_${index}`,
            subject: subjectName,
            topic: q.topic || subjectName,
            icon: icon
        }));
    }
    return [];
}

try {
    masterData = [
        ...addData(typeof staticGKData !== 'undefined' ? staticGKData : [], "Static GK", "ri-ancient-pavilion-line"),
        ...addData(typeof historyData !== 'undefined' ? historyData : [], "History", "ri-history-line"),
        ...addData(typeof polityData !== 'undefined' ? polityData : [], "Polity", "ri-government-line"),
        ...addData(typeof geographyData !== 'undefined' ? geographyData : [], "Geography", "ri-earth-line"),
        ...addData(typeof economicsData !== 'undefined' ? economicsData : [], "Economics", "ri-line-chart-line"),
        ...addData(typeof physicsData !== 'undefined' ? physicsData : [], "Physics", "ri-flask-line"),
        ...addData(typeof chemistryData !== 'undefined' ? chemistryData : [], "Chemistry", "ri-test-tube-line"),
        ...addData(typeof biologyData !== 'undefined' ? biologyData : [], "Biology", "ri-pulse-line"),
        ...addData(typeof currentAffairsData !== 'undefined' ? currentAffairsData : [], "Current Affairs", "ri-newspaper-line"),
    ];
} catch (e) { console.error("Data Load Error:", e); }

// 2. STATE
const AppState = {
    view: 'home',
    currentSubject: null,
    currentTopic: null,
    currentTestQuestions: [],
    currentQuestionIndex: 0,
    userResponses: {},
    bookmarks: JSON.parse(localStorage.getItem('ssc_scholars_bookmarks')) || [],
    timer: null,
    timeLeft: 0
};

// 3. NAVIGATION
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    AppState.view = viewId;
    window.scrollTo(0, 0);
}
function goHome() { clearInterval(AppState.timer); renderSubjectCards(); switchView('home'); }
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').className = isDark ? 'ri-moon-line' : 'ri-sun-line';
}

// 4. HOME
function renderSubjectCards() {
    const grid = document.getElementById('subject-grid');
    grid.innerHTML = '';
    [...new Set(masterData.map(q => q.subject))].forEach(sub => {
        const count = masterData.filter(q => q.subject === sub).length;
        const icon = masterData.find(q => q.subject === sub).icon;
        grid.innerHTML += '<div class="card" onclick="selectSubject(\'' + sub + '\')">'
            + '<i class="card-icon ' + icon + '"></i>'
            + '<h3>' + sub + '</h3>'
            + '<p>' + count + ' Questions</p>'
            + '</div>';
    });
}

function selectSubject(sub) {
    AppState.currentSubject = sub;
    document.getElementById('selected-subject-title').innerText = sub;
    const qs = masterData.filter(q => q.subject === sub);
    const list = document.getElementById('topic-list');
    list.innerHTML = '';
    [...new Set(qs.map(q => q.topic))].sort().forEach(function(t) {
        const c = qs.filter(q => q.topic === t).length;
        const safeT = t.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        list.innerHTML += '<div class="list-item" onclick="selectTopic(\'' + safeT + '\')">'
            + '<span class="topic-name">' + t + '</span>'
            + '<span class="topic-count">' + c + ' Qs</span>'
            + '</div>';
    });
    switchView('topics');
}

function selectTopic(t) {
    AppState.currentTopic = t;
    document.getElementById('selected-topic-title').innerText = t;
    const qs = masterData.filter(q => q.subject === AppState.currentSubject && q.topic === t);
    const chunkSize = 15, total = Math.ceil(qs.length / chunkSize);
    const grid = document.getElementById('test-list');
    grid.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const s = i * chunkSize + 1;
        const e = Math.min((i + 1) * chunkSize, qs.length);
        grid.innerHTML += '<div class="test-card" onclick="startTest(' + i + ', ' + chunkSize + ')">'
            + '<div class="test-num">Test ' + (i+1) + '</div>'
            + '<div class="test-range">Q ' + s + ' \u2013 ' + e + '</div>'
            + '<div class="test-meta">' + (e - s + 1) + ' Questions</div>'
            + '</div>';
    }
    switchView('tests');
}
function goBackToTopics() { switchView('topics'); }

// 5. QUIZ
function startTest(idx, size) {
    const qs = masterData.filter(q => q.subject === AppState.currentSubject && q.topic === AppState.currentTopic);
    AppState.currentTestQuestions = qs.slice(idx * size, idx * size + size);
    AppState.currentQuestionIndex = 0;
    AppState.userResponses = {};
    AppState.timeLeft = 7 * 60;
    renderPalette();
    loadQuestion(0);
    startTimer();
    switchView('quiz');
}
function startTimer() {
    clearInterval(AppState.timer);
    updateTimer();
    AppState.timer = setInterval(function() {
        AppState.timeLeft--;
        updateTimer();
        if (AppState.timeLeft <= 0) submitTest();
    }, 1000);
}
function updateTimer() {
    const m = Math.floor(AppState.timeLeft / 60).toString().padStart(2, '0');
    const s = (AppState.timeLeft % 60).toString().padStart(2, '0');
    const disp = document.getElementById('timer-display');
    disp.innerText = m + ':' + s;
    disp.style.color = AppState.timeLeft <= 60 ? '#e74c3c' : '';
}

function loadQuestion(i) {
    AppState.currentQuestionIndex = i;
    const q = AppState.currentTestQuestions[i];
    document.getElementById('q-subject-badge').innerText = q.topic;
    document.getElementById('current-q-num').innerText = i + 1;
    document.getElementById('total-q-num').innerText = AppState.currentTestQuestions.length;
    document.getElementById('question-content').innerHTML = formatQuestionText(cleanText(q.question));

    const div = document.getElementById('options-container');
    div.innerHTML = '';
    ['a', 'b', 'c', 'd'].forEach(function(k) {
        if (!q.options[k]) return;
        const isSelected = AppState.userResponses[i] === k;
        div.innerHTML += '<div class="option-row ' + (isSelected ? 'selected' : '') + '" onclick="selectOption(' + i + ',\'' + k + '\')">'
            + '<div class="opt-circle">' + k.toUpperCase() + '</div>'
            + '<div class="opt-text">' + cleanText(q.options[k]) + '</div>'
            + '</div>';
    });
    updatePaletteUI();
}

function selectOption(i, k) { AppState.userResponses[i] = k; loadQuestion(i); }
function clearResponse() { delete AppState.userResponses[AppState.currentQuestionIndex]; loadQuestion(AppState.currentQuestionIndex); }
function saveAndNext() {
    if (AppState.currentQuestionIndex < AppState.currentTestQuestions.length - 1)
        loadQuestion(AppState.currentQuestionIndex + 1);
}
function bookmarkCurrentQuestion() {
    const id = AppState.currentTestQuestions[AppState.currentQuestionIndex].uniqueId;
    const idx = AppState.bookmarks.indexOf(id);
    if (idx === -1) AppState.bookmarks.push(id); else AppState.bookmarks.splice(idx, 1);
    localStorage.setItem('ssc_scholars_bookmarks', JSON.stringify(AppState.bookmarks));
    updatePaletteUI();
}

function renderPalette() {
    const g = document.getElementById('palette-grid');
    g.innerHTML = '';
    AppState.currentTestQuestions.forEach(function(_, i) {
        g.innerHTML += '<button class="pal-btn" id="pal-btn-' + i + '" onclick="loadQuestion(' + i + ')">' + (i+1) + '</button>';
    });
}
function updatePaletteUI() {
    AppState.currentTestQuestions.forEach(function(q, i) {
        const b = document.getElementById('pal-btn-' + i);
        if (!b) return;
        b.className = 'pal-btn';
        if (i === AppState.currentQuestionIndex) b.classList.add('active');
        if (AppState.userResponses[i]) b.classList.add('answered');
        else if (AppState.bookmarks.includes(q.uniqueId)) b.classList.add('marked');
    });
}

// ---- TEXT CLEANING & FORMATTING ----
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/www\.(ssccglpinnacle|sscpinnacle|pinnacle)\.(com|in)[^\s]*/gi, '')
        .replace(/Download Pinnacle Exam Preparation App/gi, '')
        .replace(/Pinnacle\s+(History|Polity|Geography|Economics|Physics|Chemistry|Biology|GK|GS|Static|Science)/gi, '')
        .replace(/df\s+Pinnacle/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function formatQuestionText(text) {
    if (!text) return '';
    // Extract exam tag from end
    const examTagRx = /(SSC\s+[\w\s\/\-]+\d{2}\/\d{2}\/\d{4}[^]*)$/;
    const tagMatch = text.match(examTagRx);
    let examTag = '', cleanQ = text;
    if (tagMatch) {
        examTag = tagMatch[0].trim();
        cleanQ = text.replace(tagMatch[0], '').trim();
    }
    const examBadge = examTag
        ? '<div class="exam-tag"><i class="ri-file-list-3-line"></i> ' + examTag + '</div>'
        : '';

    let html = '';
    if (/match\s+(the\s+following|list)/i.test(cleanQ) || /column\s+[a-z]/i.test(cleanQ)) {
        html = formatMatchQuestion(cleanQ);
    } else if (/\b[1-9][\.\)]\s+\w/.test(cleanQ)) {
        html = formatNumberedQuestion(cleanQ);
    } else {
        html = '<div class="q-text-plain">' + cleanQ + '</div>';
    }
    return html + examBadge;
}

function formatNumberedQuestion(text) {
    const firstNum = text.search(/\b1[\.\)]\s/);
    const stem = firstNum > 0 ? text.slice(0, firstNum).trim() : '';
    const rest = firstNum > 0 ? text.slice(firstNum) : text;
    const items = rest.split(/(?=\b\d+[\.\)]\s)/).filter(function(s) { return s.trim(); });
    let html = stem ? '<div class="q-stem">' + stem + '</div>' : '';
    html += '<ol class="q-statements">';
    items.forEach(function(item) {
        const cleaned = item.replace(/^\d+[\.\)]\s*/, '').trim();
        if (cleaned) html += '<li>' + cleaned + '</li>';
    });
    html += '</ol>';
    return html;
}

function formatMatchQuestion(text) {
    // Determine stem
    let stem = '', tableData = text;
    const matchStemRx = /^(Match[^:\.]*[:\.])\s*/i;
    const ms = text.match(matchStemRx);
    if (ms) { stem = ms[1]; tableData = text.slice(ms[0].length).trim(); }

    // Parse column headers if present
    let colA = 'Column A', colB = 'Column B';
    const hdrRx = /^([A-Za-z][A-Za-z\s\/\(\)-]{2,30})\s+((?:Year|Name|Person|Founder|Author|Period)[A-Za-z\s\/]*)/i;
    const hm = tableData.match(hdrRx);
    if (hm) { colA = hm[1].trim(); colB = hm[2].trim(); tableData = tableData.slice(hm[0].length).trim(); }

    // Check for List-I / List-II header
    const listHdr = tableData.match(/List[- ]?I\s*(?:\([^\)]*\))?\s+List[- ]?II\s*(?:\([^\)]*\))?/i);
    if (listHdr) {
        const parts = listHdr[0].split(/List[- ]?II/i);
        colA = parts[0].trim() || 'List-I';
        colB = 'List-II';
        tableData = tableData.slice(listHdr[0].length).trim();
    }

    // Parse left: a. / a) patterns
    const leftItems = [];
    const rightItems = [];
    const lRx = /\b([a-dA-D])[\.\)]\s+(.+?)(?=\s+\b[a-dA-D][\.\)]|\s+\b[iIvV]+[\.\)]|\s+\b[1-4][\.\)]|$)/g;
    const rRx = /\b([iIvV]+|[1-4])[\.\)]\s+(.+?)(?=\s+\b[a-dA-D][\.\)]|\s+\b[iIvV]+[\.\)]|\s+\b[1-4][\.\)]|$)/g;
    let m;
    while ((m = lRx.exec(tableData)) !== null) leftItems.push({ key: m[1].toUpperCase(), val: m[2].trim() });
    while ((m = rRx.exec(tableData)) !== null) rightItems.push({ key: m[1].toUpperCase(), val: m[2].trim() });

    if (leftItems.length === 0) return '<div class="q-text-plain">' + text + '</div>';

    const maxRows = Math.max(leftItems.length, rightItems.length);
    let html = stem ? '<div class="q-stem">' + stem + '</div>' : '';
    html += '<div class="match-table-wrap"><table class="match-table"><thead><tr><th>' + colA + '</th><th>' + colB + '</th></tr></thead><tbody>';
    for (let i = 0; i < maxRows; i++) {
        const l = leftItems[i] || { key: '', val: '' };
        const r = rightItems[i] || { key: '', val: '' };
        html += '<tr><td><span class="match-key">' + l.key + '</span> ' + l.val + '</td>'
              + '<td><span class="match-key">' + r.key + '</span> ' + r.val + '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

// 6. RESULT & REVIEW
function submitTest() {
    clearInterval(AppState.timer);
    let c = 0, w = 0;
    const att = Object.keys(AppState.userResponses).length;
    const total = AppState.currentTestQuestions.length;
    AppState.currentTestQuestions.forEach(function(q, i) {
        const a = AppState.userResponses[i];
        if (a) { if (a === q.correct) c++; else w++; }
    });
    const score = (c * 2) - (w * 0.5);
    const timeTaken = (7 * 60) - AppState.timeLeft;

    document.getElementById('final-score').innerText = score.toFixed(1);
    document.getElementById('max-score').innerText = '/ ' + (total * 2);
    document.getElementById('stat-correct').innerText = c;
    document.getElementById('stat-wrong').innerText = w;
    document.getElementById('stat-skipped').innerText = total - att;
    document.getElementById('stat-accuracy').innerText = att > 0 ? ((c / att) * 100).toFixed(1) + '%' : '0%';
    document.getElementById('stat-attempted').innerText = att + '/' + total;
    document.getElementById('stat-time').innerText = Math.floor(timeTaken / 60) + 'm ' + (timeTaken % 60) + 's';
    renderScoreDonut(c, w, total - att);
    switchView('result');
}

function renderScoreDonut(correct, wrong, skipped) {
    const canvas = document.getElementById('score-donut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = correct + wrong + skipped;
    if (total === 0) return;
    const data = [
        { val: correct, color: '#27ae60' },
        { val: wrong, color: '#eb4d4b' },
        { val: skipped, color: '#d0d7e3' }
    ];
    let startAngle = -Math.PI / 2;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = 58;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    data.forEach(function(d) {
        if (d.val === 0) return;
        const slice = (d.val / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = d.color;
        ctx.fill();
        startAngle += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, 2 * Math.PI);
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
    ctx.fillStyle = bgColor;
    ctx.fill();
}

function startReview() { renderReview(AppState.currentTestQuestions, AppState.userResponses); switchView('review'); }

function openSavedSection() {
    AppState.view = 'saved';
    const s = masterData.filter(function(q) { return AppState.bookmarks.includes(q.uniqueId); });
    if (!s.length) { alert('No saved questions.'); return; }
    const f = document.getElementById('saved-subject-filter');
    f.style.display = 'block';
    f.innerHTML = '<option value="all">All Subjects</option>';
    [...new Set(s.map(function(q) { return q.subject; }))].forEach(function(sub) {
        f.innerHTML += '<option value="' + sub + '">' + sub + '</option>';
    });
    renderReview(s, {});
    switchView('review');
}
function filterSavedQuestions() {
    const sub = document.getElementById('saved-subject-filter').value;
    let s = masterData.filter(function(q) { return AppState.bookmarks.includes(q.uniqueId); });
    if (sub !== 'all') s = s.filter(function(q) { return q.subject === sub; });
    renderReview(s, {});
}

function formatExplanation(text, corKey, opts) {
    if (!text) return '<em style="color:#888;">No explanation available.</em>';
    let clean = cleanText(text);
    clean = clean.replace(/^Sol\.\s*\d*\.?\s*(\([a-z]\))?/i, '').trim();
    clean = clean.replace(/\b(18|19|20)\d{2}\b/g, '<span class="highlight-year">$&</span>');
    clean = clean.replace(/\b(Article\s\d+[A-Z]?|Art\.\s*\d+[A-Z]?)\b/gi, '<span class="highlight-article">$&</span>');
    return '<div class="sol-correct-tag">'
        + '<i class="ri-checkbox-circle-fill"></i> Correct Answer: <b>' + cleanText(opts[corKey]) + '</b>'
        + '</div>'
        + '<div class="sol-text">' + clean + '</div>';
}

function renderReview(qs, res) {
    const c = document.getElementById('review-container');
    c.innerHTML = '';
    const isSaved = AppState.view === 'saved';
    document.getElementById('review-back-text').innerText = isSaved ? 'Home' : 'Result';
    document.getElementById('review-title').innerText = isSaved ? 'Saved Questions' : 'Solutions';

    qs.forEach(function(q, i) {
        const a = res[i];
        let statusClass = 'skipped', statusLabel = 'Skipped', statusIcon = 'ri-skip-forward-line';
        if (a) {
            if (a === q.correct) { statusClass = 'correct'; statusLabel = '+2.0'; statusIcon = 'ri-checkbox-circle-line'; }
            else { statusClass = 'wrong'; statusLabel = '\u22120.5'; statusIcon = 'ri-close-circle-line'; }
        } else if (isSaved) { statusClass = 'saved-item'; statusLabel = q.subject; statusIcon = 'ri-bookmark-fill'; }

        const questionHtml = formatQuestionText(cleanText(q.question));
        const optionsHtml = ['a', 'b', 'c', 'd'].map(function(k) {
            if (!q.options[k]) return '';
            let cls = 'rev-opt';
            let icon = '';
            if (k === q.correct) { cls += ' rev-correct'; icon = '<i class="ri-checkbox-circle-fill"></i>'; }
            else if (k === a) { cls += ' rev-wrong'; icon = '<i class="ri-close-circle-fill"></i>'; }
            return '<div class="' + cls + '">'
                + '<span class="rev-opt-key">' + k.toUpperCase() + '</span>'
                + '<span class="rev-opt-text">' + cleanText(q.options[k]) + '</span>'
                + '<span class="rev-opt-icon">' + icon + '</span>'
                + '</div>';
        }).join('');

        c.innerHTML += '<div class="review-card ' + statusClass + '">'
            + '<div class="review-card-header">'
            + '<div class="rev-meta"><span class="rev-topic-tag">' + q.topic + '</span><span class="rev-qnum">Q.' + (i+1) + '</span></div>'
            + '<div class="rev-status ' + statusClass + '"><i class="' + statusIcon + '"></i> ' + statusLabel + '</div>'
            + '</div>'
            + '<div class="rev-question">' + questionHtml + '</div>'
            + '<div class="rev-options">' + optionsHtml + '</div>'
            + '<details class="sol-details">'
            + '<summary class="sol-summary"><i class="ri-lightbulb-flash-line"></i> View Solution <i class="ri-arrow-down-s-line sol-arrow"></i></summary>'
            + '<div class="sol-body-new">' + formatExplanation(q.solution, q.correct, q.options) + '</div>'
            + '</details>'
            + '</div>';
    });
}

function exitReview() { AppState.view === 'saved' ? goHome() : switchView('result'); }
window.onload = goHome;
