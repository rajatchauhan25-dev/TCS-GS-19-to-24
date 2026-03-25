// =============================================
// DATA LOADING
// =============================================
let masterData = [];

function addData(source, subjectName, icon) {
    if (typeof source !== 'undefined' && Array.isArray(source)) {
        return source.map((q, index) => ({
            ...q,
            originalId: q.id,
            uniqueId: `${subjectName.replace(/\s/g,'')}_${q.id}_${index}`,
            subject: subjectName,
            topic: q.topic || subjectName,
            icon: icon
        }));
    }
    return [];
}

try {
    masterData = [
        ...addData(typeof staticGKData!=='undefined'?staticGKData:[], "Static GK","ri-ancient-pavilion-line"),
        ...addData(typeof historyData!=='undefined'?historyData:[], "History","ri-history-line"),
        ...addData(typeof polityData!=='undefined'?polityData:[], "Polity","ri-government-line"),
        ...addData(typeof geographyData!=='undefined'?geographyData:[], "Geography","ri-earth-line"),
        ...addData(typeof economicsData!=='undefined'?economicsData:[], "Economics","ri-line-chart-line"),
        ...addData(typeof physicsData!=='undefined'?physicsData:[], "Physics","ri-flask-line"),
        ...addData(typeof chemistryData!=='undefined'?chemistryData:[], "Chemistry","ri-test-tube-line"),
        ...addData(typeof biologyData!=='undefined'?biologyData:[], "Biology","ri-pulse-line"),
        ...addData(typeof currentAffairsData!=='undefined'?currentAffairsData:[], "Current Affairs","ri-newspaper-line"),
    ];
} catch(e){ console.error("Data Load Error:",e); }

// =============================================
// STATE
// =============================================
const AppState = {
    view: 'home',
    currentSubject: null,
    currentTopic: null,
    currentTestQuestions: [],
    currentQuestionIndex: 0,
    userResponses: {},
    bookmarks: JSON.parse(localStorage.getItem('ssc_bookmarks')||'[]'),
    blunders: JSON.parse(localStorage.getItem('ssc_blunders')||'[]'), // {uniqueId, subject, topic, type:'wrong'|'skipped'}
    savedAttempts: JSON.parse(localStorage.getItem('ssc_attempts')||'[]'), // [{id, subject, topic, test, date, responses, score}]
    timer: null,
    timeLeft: 0,
    currentTestMeta: {}
};

function saveState(){
    localStorage.setItem('ssc_bookmarks', JSON.stringify(AppState.bookmarks));
    localStorage.setItem('ssc_blunders', JSON.stringify(AppState.blunders));
    localStorage.setItem('ssc_attempts', JSON.stringify(AppState.savedAttempts));
}

// =============================================
// NAVIGATION
// =============================================
function switchView(viewId){
    document.querySelectorAll('.view-section').forEach(el=>el.classList.remove('active'));
    document.getElementById('view-'+viewId).classList.add('active');
    AppState.view = viewId;
    window.scrollTo(0,0);
}
function goHome(){ clearInterval(AppState.timer); renderSubjectCards(); switchView('home'); }
function toggleTheme(){
    const html=document.documentElement;
    const isDark=html.getAttribute('data-theme')==='dark';
    html.setAttribute('data-theme', isDark?'light':'dark');
    document.getElementById('theme-icon').className = isDark?'ri-moon-line':'ri-sun-line';
}

// =============================================
// HOME
// =============================================
function renderSubjectCards(){
    const grid=document.getElementById('subject-grid');
    grid.innerHTML='';
    [...new Set(masterData.map(q=>q.subject))].forEach(sub=>{
        const count=masterData.filter(q=>q.subject===sub).length;
        const icon=masterData.find(q=>q.subject===sub).icon;
        grid.innerHTML+=`<div class="card" onclick="selectSubject('${sub}')">
            <i class="card-icon ${icon}"></i>
            <h3>${sub}</h3>
            <p>${count} Questions</p>
        </div>`;
    });
}

function selectSubject(sub){
    AppState.currentSubject=sub;
    document.getElementById('selected-subject-title').innerText=sub;
    const qs=masterData.filter(q=>q.subject===sub);
    const list=document.getElementById('topic-list');
    list.innerHTML='';
    [...new Set(qs.map(q=>q.topic))].sort().forEach(t=>{
        const c=qs.filter(q=>q.topic===t).length;
        const safeT=t.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        list.innerHTML+=`<div class="list-item" onclick="selectTopic('${safeT}')">
            <span class="topic-name">${t}</span>
            <span class="topic-count">${c} Qs</span>
        </div>`;
    });
    switchView('topics');
}

function selectTopic(t){
    AppState.currentTopic=t;
    document.getElementById('selected-topic-title').innerText=t;
    const qs=masterData.filter(q=>q.subject===AppState.currentSubject&&q.topic===t);
    const chunkSize=15, total=Math.ceil(qs.length/chunkSize);
    const grid=document.getElementById('test-list');
    grid.innerHTML='';
    for(let i=0;i<total;i++){
        const s=i*chunkSize+1, e=Math.min((i+1)*chunkSize,qs.length);
        grid.innerHTML+=`<div class="test-card" onclick="startTest(${i},${chunkSize})">
            <div class="test-num">Test ${i+1}</div>
            <div class="test-range">Q ${s} – ${e}</div>
            <div class="test-meta">${e-s+1} Questions</div>
        </div>`;
    }
    switchView('tests');
}
function goBackToTopics(){ switchView('topics'); }

// =============================================
// QUIZ
// =============================================
function startTest(idx, size){
    const qs=masterData.filter(q=>q.subject===AppState.currentSubject&&q.topic===AppState.currentTopic);
    AppState.currentTestQuestions=qs.slice(idx*size, idx*size+size);
    AppState.currentQuestionIndex=0;
    AppState.userResponses={};
    AppState.timeLeft=7*60;
    AppState.currentTestMeta={subject:AppState.currentSubject, topic:AppState.currentTopic, testIdx:idx};
    renderPalette();
    loadQuestion(0);
    startTimer();
    switchView('quiz');
}
function startTimer(){
    clearInterval(AppState.timer);
    updateTimer();
    AppState.timer=setInterval(()=>{
        AppState.timeLeft--;
        updateTimer();
        if(AppState.timeLeft<=0) submitTest();
    },1000);
}
function updateTimer(){
    const m=Math.floor(AppState.timeLeft/60).toString().padStart(2,'0');
    const s=(AppState.timeLeft%60).toString().padStart(2,'0');
    const disp=document.getElementById('timer-display');
    disp.innerText=m+':'+s;
    disp.style.color=AppState.timeLeft<=60?'#e74c3c':'';
}

function loadQuestion(i){
    AppState.currentQuestionIndex=i;
    const q=AppState.currentTestQuestions[i];
    document.getElementById('q-subject-badge').innerText=q.topic;
    document.getElementById('current-q-num').innerText=i+1;
    document.getElementById('total-q-num').innerText=AppState.currentTestQuestions.length;
    document.getElementById('question-content').innerHTML=formatQuestionText(cleanText(q.question));
    const div=document.getElementById('options-container');
    div.innerHTML='';
    ['a','b','c','d'].forEach(k=>{
        if(!q.options[k]) return;
        const sel=AppState.userResponses[i]===k;
        div.innerHTML+=`<div class="option-row ${sel?'selected':''}" onclick="selectOption(${i},'${k}')">
            <div class="opt-circle">${k.toUpperCase()}</div>
            <div class="opt-text">${cleanText(q.options[k])}</div>
        </div>`;
    });
    updatePaletteUI();
}

function selectOption(i,k){ AppState.userResponses[i]=k; loadQuestion(i); }
function clearResponse(){ delete AppState.userResponses[AppState.currentQuestionIndex]; loadQuestion(AppState.currentQuestionIndex); }
function saveAndNext(){ if(AppState.currentQuestionIndex<AppState.currentTestQuestions.length-1) loadQuestion(AppState.currentQuestionIndex+1); }
function bookmarkCurrentQuestion(){
    const id=AppState.currentTestQuestions[AppState.currentQuestionIndex].uniqueId;
    const idx=AppState.bookmarks.indexOf(id);
    if(idx===-1) AppState.bookmarks.push(id); else AppState.bookmarks.splice(idx,1);
    saveState();
    updatePaletteUI();
    // visual feedback on mark button
    const isMarked=AppState.bookmarks.includes(id);
    const btn=document.querySelector('.btn-mark');
    if(btn){ btn.style.background=isMarked?'var(--warning)':''; btn.style.color=isMarked?'white':''; }
}

function renderPalette(){
    const g=document.getElementById('palette-grid');
    g.innerHTML='';
    AppState.currentTestQuestions.forEach((_,i)=>{
        g.innerHTML+=`<button class="pal-btn" id="pal-btn-${i}" onclick="loadQuestion(${i})">${i+1}</button>`;
    });
}
function updatePaletteUI(){
    AppState.currentTestQuestions.forEach((q,i)=>{
        const b=document.getElementById('pal-btn-'+i);
        if(!b) return;
        b.className='pal-btn';
        if(i===AppState.currentQuestionIndex) b.classList.add('active');
        if(AppState.userResponses[i]) b.classList.add('answered');
        else if(AppState.bookmarks.includes(q.uniqueId)) b.classList.add('marked');
    });
}

// =============================================
// TEXT CLEANING
// =============================================
function cleanText(text){
    if(!text) return '';
    return text
        .replace(/www\.(ssccglpinnacle|sscpinnacle|pinnacle)\.(com|in)\S*/gi,'')
        .replace(/Download Pinnacle Exam Preparation App/gi,'')
        .replace(/Pinnacle\s+(History|Polity|Geography|Economics|Physics|Chemistry|Biology|GK|GS|Static|Science)/gi,'')
        .replace(/df\s*Pinnacle/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
}

// =============================================
// QUESTION FORMATTING — FIXED
// =============================================
function extractExamTag(text){
    // Extract trailing exam tag like "SSC CGL 17/09/2024 (3rd Shift)"
    const rx=/(SSC\s+\S+(?:\s+\S+){0,3}\s+\d{2}\/\d{2}\/\d{4}(?:\s*\([^)]*\))?)$/i;
    const m=text.match(rx);
    if(m){
        return { tag: m[1].trim(), clean: text.slice(0, text.length - m[1].length).trim() };
    }
    return { tag:'', clean: text.trim() };
}

function formatQuestionText(text){
    if(!text) return '';
    const {tag, clean} = extractExamTag(text);
    const examBadge = tag ? `<div class="exam-tag"><i class="ri-file-list-3-line"></i> ${tag}</div>` : '';
    let html='';
    if(/match\s+(the\s+following|list)/i.test(clean)||/column\s+[a-z]/i.test(clean)){
        html=formatMatchQuestion(clean);
    } else if(hasRomanNumerals(clean)||hasArabicNumerals(clean)){
        html=formatNumberedQuestion(clean);
    } else {
        html=`<div class="q-text-plain">${clean}</div>`;
    }
    return html+examBadge;
}

function hasRomanNumerals(text){
    // Looks for "I. word" "II. word" "III. word" "IV. word" pattern (uppercase roman numerals followed by dot and space)
    return /\b(I{1,3}|IV|V?I{0,3}|IX|XI{0,3}|XIV)\.\s+\S/.test(text);
}
function hasArabicNumerals(text){
    return /\b[1-9]\.\s+\S/.test(text)||/\b[1-9]\)\s+\S/.test(text);
}

function formatNumberedQuestion(text){
    // Split on numbered items — supports: "1. " "1) " "I. " "II. " "III. " "IV. " "V. " etc.
    // We need to detect where numbered list starts
    const romanRx=/(?=\b(?:I{1,3}V?|IV|VI{0,3}|IX|X)\.\s)/;
    const arabicRx=/(?=\b[1-9][\.\)]\s)/;

    let splitRx, isRoman=false;
    if(hasRomanNumerals(text)){
        // Roman numeral split — careful: match standalone I. II. III. IV. V.
        splitRx=/(?=\b(?:I{1,3}|IV|V|VI{0,3}|IX|X{1,2})\.\s)/;
        isRoman=true;
    } else {
        splitRx=/(?=\b[1-9][\.\)]\s)/;
    }

    // Find where the list starts
    const listStart=findListStart(text, isRoman);
    const stem=listStart>0 ? text.slice(0,listStart).trim() : '';
    const listPart=listStart>=0 ? text.slice(listStart) : text;

    // Split into items
    const items=listPart.split(splitRx).filter(s=>s.trim().length>0);

    let html=stem?`<div class="q-stem">${stem}</div>`:'';
    html+=`<ol class="q-statements ${isRoman?'roman-list':'arabic-list'}">`;
    items.forEach(item=>{
        // Remove leading "I. " or "1. " or "1) "
        const cleaned=item.replace(/^\s*(?:[IVXLC]+|[0-9]+)[\.\)]\s*/,'').trim();
        if(cleaned) html+=`<li>${cleaned}</li>`;
    });
    html+=`</ol>`;
    return html;
}

function findListStart(text, isRoman){
    let rx;
    if(isRoman){
        // Find first occurrence of standalone "I. " (capital I followed by dot-space, not part of a word)
        rx=/(?<!\w)I\.\s/;
    } else {
        rx=/\b1[\.\)]\s/;
    }
    const m=text.search(rx);
    return m;
}

function formatMatchQuestion(text){
    let stem='', tableData=text;
    const ms=text.match(/^(Match[^\.:\n]*[\.:])\s*/i);
    if(ms){ stem=ms[1]; tableData=text.slice(ms[0].length).trim(); }
    else {
        // Try: everything before first column header or "List"
        const hdrPos=text.search(/\b(List[- ]?[I1]|Column [A-Z])\b/i);
        if(hdrPos>5){ stem=text.slice(0,hdrPos).trim(); tableData=text.slice(hdrPos).trim(); }
    }

    let colA='Column A', colB='Column B';
    const listHdr=tableData.match(/List[- ]?I\s*(?:\([^\)]*\))?\s+List[- ]?II\s*(?:\([^\)]*\))?/i);
    if(listHdr){
        const parts=listHdr[0].split(/List[- ]?II/i);
        colA=parts[0].trim()||'List-I'; colB='List-II';
        tableData=tableData.slice(listHdr[0].length).trim();
    } else {
        // Generic two-word headers before items
        const genericHdr=tableData.match(/^([A-Za-z][A-Za-z\s\/\(\)-]{2,30})\s+((?:Year|Name|Person|Founder|Author|Period|Place|Country|River|State)[A-Za-z\s\/]*)/i);
        if(genericHdr){ colA=genericHdr[1].trim(); colB=genericHdr[2].trim(); tableData=tableData.slice(genericHdr[0].length).trim(); }
    }

    // Parse left (a. b. c. d. or A. B. C. D.) and right (i. ii. iii. iv. or 1. 2. 3. 4.)
    const leftItems=[], rightItems=[];
    const lRx=/\b([a-dA-D])[\.\)]\s+(.+?)(?=\s+\b[a-dA-D][\.\)]|\s+\b(?:i{1,3}v?|iv|vi{0,3})[\.\)]|\s+\b[1-4][\.\)]|$)/g;
    const rRx=/\b(i{1,3}v?|iv|vi{0,3}|[1-4])[\.\)]\s+(.+?)(?=\s+\b[a-dA-D][\.\)]|\s+\b(?:i{1,3}v?|iv|vi{0,3})[\.\)]|\s+\b[1-4][\.\)]|$)/gi;
    let m;
    while((m=lRx.exec(tableData))!==null) leftItems.push({key:m[1].toUpperCase(),val:m[2].trim()});
    while((m=rRx.exec(tableData))!==null) rightItems.push({key:m[1].toUpperCase(),val:m[2].trim()});

    if(leftItems.length===0) return `<div class="q-text-plain">${text}</div>`;

    const maxRows=Math.max(leftItems.length,rightItems.length);
    let html=stem?`<div class="q-stem">${stem}</div>`:'';
    html+=`<div class="match-table-wrap"><table class="match-table">
        <thead><tr><th>${colA}</th><th>${colB}</th></tr></thead><tbody>`;
    for(let i=0;i<maxRows;i++){
        const l=leftItems[i]||{key:'',val:''};
        const r=rightItems[i]||{key:'',val:''};
        html+=`<tr>
            <td><span class="match-key">${l.key}</span> ${l.val}</td>
            <td><span class="match-key">${r.key}</span> ${r.val}</td>
        </tr>`;
    }
    html+=`</tbody></table></div>`;
    return html;
}

// =============================================
// SUBMIT TEST + SAVE BLUNDERS + SAVE ATTEMPT
// =============================================
function submitTest(){
    clearInterval(AppState.timer);
    let correct=0, wrong=0;
    const total=AppState.currentTestQuestions.length;
    const att=Object.keys(AppState.userResponses).length;
    const timeTaken=(7*60)-AppState.timeLeft;

    // Save blunders (wrong + skipped)
    AppState.currentTestQuestions.forEach((q,i)=>{
        const a=AppState.userResponses[i];
        if(a===q.correct){ correct++; }
        else {
            const type = a ? 'wrong' : 'skipped';
            if(a) wrong++;
            // Add to blunders if not already present
            const existingIdx=AppState.blunders.findIndex(b=>b.uniqueId===q.uniqueId);
            if(existingIdx===-1){
                AppState.blunders.push({uniqueId:q.uniqueId, subject:q.subject, topic:q.topic, type});
            } else {
                AppState.blunders[existingIdx].type=type; // update type
            }
        }
    });

    // Save this attempt
    const attemptId='attempt_'+Date.now();
    const attemptRecord={
        id: attemptId,
        subject: AppState.currentTestMeta.subject,
        topic: AppState.currentTestMeta.topic,
        testIdx: AppState.currentTestMeta.testIdx,
        date: new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
        time: new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
        responses: {...AppState.userResponses},
        score: (correct*2)-(wrong*0.5),
        correct, wrong, skipped: total-att,
        total, timeTaken
    };
    AppState.savedAttempts.unshift(attemptRecord); // newest first
    if(AppState.savedAttempts.length>50) AppState.savedAttempts.pop(); // keep max 50
    saveState();

    // Update result UI
    const score=(correct*2)-(wrong*0.5);
    document.getElementById('final-score').innerText=score.toFixed(1);
    document.getElementById('max-score').innerText='/ '+(total*2);
    document.getElementById('stat-correct').innerText=correct;
    document.getElementById('stat-wrong').innerText=wrong;
    document.getElementById('stat-skipped').innerText=total-att;
    document.getElementById('stat-accuracy').innerText=att>0?((correct/att)*100).toFixed(1)+'%':'0%';
    document.getElementById('stat-attempted').innerText=att+'/'+total;
    document.getElementById('stat-time').innerText=Math.floor(timeTaken/60)+'m '+(timeTaken%60)+'s';
    document.getElementById('result-attempt-id').dataset.attemptId=attemptId;
    renderScoreDonut(correct,wrong,total-att);
    switchView('result');
}

function renderScoreDonut(correct,wrong,skipped){
    const canvas=document.getElementById('score-donut');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const total=correct+wrong+skipped;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(total===0) return;
    const data=[{val:correct,color:'#16a34a'},{val:wrong,color:'#dc2626'},{val:skipped,color:'#d0d7e3'}];
    let startAngle=-Math.PI/2;
    const cx=canvas.width/2,cy=canvas.height/2,r=58;
    data.forEach(d=>{
        if(d.val===0) return;
        const slice=(d.val/total)*2*Math.PI;
        ctx.beginPath(); ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,r,startAngle,startAngle+slice);
        ctx.closePath(); ctx.fillStyle=d.color; ctx.fill();
        startAngle+=slice;
    });
    ctx.beginPath(); ctx.arc(cx,cy,36,0,2*Math.PI);
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim()||'#fff';
    ctx.fill();
}

// =============================================
// REVIEW
// =============================================
function startReview(){
    renderReview(AppState.currentTestQuestions, AppState.userResponses, 'review');
    switchView('review');
}

function formatExplanation(text, corKey, opts){
    if(!text) return '<em style="color:#888">No explanation available.</em>';
    let clean=cleanText(text);
    clean=clean.replace(/^Sol\.\s*\d*\.?\s*(\([a-z]\))?/i,'').trim();
    clean=clean.replace(/\b(18|19|20)\d{2}\b/g,'<span class="highlight-year">$&</span>');
    clean=clean.replace(/\b(Article\s\d+[A-Z]?|Art\.\s*\d+[A-Z]?)\b/gi,'<span class="highlight-article">$&</span>');
    return `<div class="sol-correct-tag"><i class="ri-checkbox-circle-fill"></i> Correct: <b>${cleanText(opts[corKey])}</b></div>
    <div class="sol-text">${clean}</div>`;
}

function renderReview(qs, res, mode){
    const c=document.getElementById('review-container');
    c.innerHTML='';
    document.getElementById('saved-subject-filter').style.display='none';

    qs.forEach((q,i)=>{
        const a=res[i]||res[q.uniqueId];
        let statusClass='skipped', statusLabel='Skipped', statusIcon='ri-skip-forward-line';
        if(a){
            if(a===q.correct){statusClass='correct';statusLabel='+2.0';statusIcon='ri-checkbox-circle-line';}
            else{statusClass='wrong';statusLabel='−0.5';statusIcon='ri-close-circle-line';}
        }
        if(mode==='saved'){statusClass='saved-item';statusLabel=q.subject;statusIcon='ri-bookmark-fill';}

        const questionHtml=formatQuestionText(cleanText(q.question));
        const optionsHtml=['a','b','c','d'].map(k=>{
            if(!q.options[k]) return '';
            let cls='rev-opt', icon='';
            if(k===q.correct){cls+=' rev-correct';icon='<i class="ri-checkbox-circle-fill"></i>';}
            else if(k===a){cls+=' rev-wrong';icon='<i class="ri-close-circle-fill"></i>';}
            return `<div class="${cls}">
                <span class="rev-opt-key">${k.toUpperCase()}</span>
                <span class="rev-opt-text">${cleanText(q.options[k])}</span>
                <span class="rev-opt-icon">${icon}</span>
            </div>`;
        }).join('');

        c.innerHTML+=`<div class="review-card ${statusClass}">
            <div class="review-card-header">
                <div class="rev-meta">
                    <span class="rev-topic-tag">${q.topic}</span>
                    <span class="rev-qnum">Q.${i+1}</span>
                </div>
                <div class="rev-status ${statusClass}"><i class="${statusIcon}"></i> ${statusLabel}</div>
            </div>
            <div class="rev-question">${questionHtml}</div>
            <div class="rev-options">${optionsHtml}</div>
            <details class="sol-details">
                <summary class="sol-summary"><i class="ri-lightbulb-flash-line"></i> View Solution <i class="ri-arrow-down-s-line sol-arrow"></i></summary>
                <div class="sol-body-new">${formatExplanation(q.solution,q.correct,q.options)}</div>
            </details>
        </div>`;
    });
}

function exitReview(){
    if(AppState.view==='saved'||AppState.view==='blunders'||AppState.view==='attempts') openDashboard();
    else switchView('result');
}

// =============================================
// DASHBOARD (Blunders + Saved + Attempts)
// =============================================
function openDashboard(tab){
    tab=tab||'blunders';
    renderDashboard(tab);
    switchView('dashboard');
}

function renderDashboard(tab){
    // Set active tab
    document.querySelectorAll('.dash-tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    const container=document.getElementById('dashboard-content');
    container.innerHTML='';

    if(tab==='blunders') renderBlundersGrid(container);
    else if(tab==='saved') renderSavedGrid(container);
    else if(tab==='attempts') renderAttemptsGrid(container);
}

function renderBlundersGrid(container){
    if(AppState.blunders.length===0){
        container.innerHTML='<div class="empty-state"><i class="ri-emotion-happy-line"></i><p>No blunders yet! Keep practicing.</p></div>';
        return;
    }
    // Group by subject
    const subjects=[...new Set(AppState.blunders.map(b=>b.subject))];
    subjects.forEach(sub=>{
        const subBlunders=AppState.blunders.filter(b=>b.subject===sub);
        const topics=[...new Set(subBlunders.map(b=>b.topic))];
        container.innerHTML+=`<div class="dash-subject-section">
            <div class="dash-subject-header">
                <span class="dash-subject-name">${sub}</span>
                <span class="dash-count-badge">${subBlunders.length} questions</span>
            </div>
            <div class="dash-topic-grid">
                ${topics.map(t=>{
                    const topicQs=subBlunders.filter(b=>b.topic===t);
                    const wrongCount=topicQs.filter(b=>b.type==='wrong').length;
                    const skipCount=topicQs.filter(b=>b.type==='skipped').length;
                    return `<div class="dash-topic-card blunder-card" onclick="openBlunderTopic('${sub.replace(/'/g,"\\'")}','${t.replace(/'/g,"\\'")}')">
                        <div class="dtc-name">${t}</div>
                        <div class="dtc-stats">
                            ${wrongCount>0?`<span class="dtc-wrong"><i class="ri-close-circle-fill"></i> ${wrongCount} Wrong</span>`:''}
                            ${skipCount>0?`<span class="dtc-skip"><i class="ri-skip-forward-fill"></i> ${skipCount} Skipped</span>`:''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    });
}

function openBlunderTopic(sub,topic){
    AppState.view='blunders';
    const blunderIds=AppState.blunders.filter(b=>b.subject===sub&&b.topic===topic).map(b=>b.uniqueId);
    const qs=masterData.filter(q=>blunderIds.includes(q.uniqueId));
    document.getElementById('review-back-text').innerText='Blunders';
    document.getElementById('review-title').innerText=topic+' — Blunders';
    renderReview(qs,{},'blunders');
    switchView('review');
}

function renderSavedGrid(container){
    const savedQs=masterData.filter(q=>AppState.bookmarks.includes(q.uniqueId));
    if(savedQs.length===0){
        container.innerHTML='<div class="empty-state"><i class="ri-bookmark-line"></i><p>No saved questions yet.</p></div>';
        return;
    }
    const subjects=[...new Set(savedQs.map(q=>q.subject))];
    subjects.forEach(sub=>{
        const subQs=savedQs.filter(q=>q.subject===sub);
        const topics=[...new Set(subQs.map(q=>q.topic))];
        container.innerHTML+=`<div class="dash-subject-section">
            <div class="dash-subject-header">
                <span class="dash-subject-name">${sub}</span>
                <span class="dash-count-badge">${subQs.length} saved</span>
            </div>
            <div class="dash-topic-grid">
                ${topics.map(t=>{
                    const c=subQs.filter(q=>q.topic===t).length;
                    return `<div class="dash-topic-card saved-card" onclick="openSavedTopic('${sub.replace(/'/g,"\\'")}','${t.replace(/'/g,"\\'")}')">
                        <div class="dtc-name">${t}</div>
                        <div class="dtc-stats"><span class="dtc-saved"><i class="ri-bookmark-fill"></i> ${c} saved</span></div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    });
}

function openSavedTopic(sub,topic){
    AppState.view='saved';
    const qs=masterData.filter(q=>AppState.bookmarks.includes(q.uniqueId)&&q.subject===sub&&q.topic===topic);
    document.getElementById('review-back-text').innerText='Saved';
    document.getElementById('review-title').innerText=topic+' — Saved';
    renderReview(qs,{},'saved');
    switchView('review');
}

function openSavedSection(){
    openDashboard('saved');
}

function renderAttemptsGrid(container){
    if(AppState.savedAttempts.length===0){
        container.innerHTML='<div class="empty-state"><i class="ri-history-line"></i><p>No attempts saved yet.</p></div>';
        return;
    }
    container.innerHTML='<div class="attempts-list">'+
        AppState.savedAttempts.map((a,i)=>{
            const pct=a.total>0?Math.round((a.correct/a.total)*100):0;
            const scoreColor=pct>=70?'var(--success)':pct>=40?'var(--warning)':'var(--error)';
            return `<div class="attempt-card">
                <div class="attempt-left">
                    <div class="attempt-subject">${a.subject}</div>
                    <div class="attempt-topic">${a.topic} · Test ${a.testIdx+1}</div>
                    <div class="attempt-date"><i class="ri-calendar-line"></i> ${a.date} ${a.time}</div>
                </div>
                <div class="attempt-right">
                    <div class="attempt-score" style="color:${scoreColor}">${a.score.toFixed(1)}</div>
                    <div class="attempt-breakdown">
                        <span style="color:var(--success)">${a.correct}✓</span>
                        <span style="color:var(--error)">${a.wrong}✗</span>
                        <span style="color:var(--text-muted)">${a.skipped}–</span>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="reviewAttempt(${i})"><i class="ri-eye-line"></i> Review</button>
                </div>
            </div>`;
        }).join('')+
    '</div>';
}

function reviewAttempt(idx){
    const attempt=AppState.savedAttempts[idx];
    AppState.view='attempts';
    // Get the questions for this attempt
    const qs=masterData.filter(q=>q.subject===attempt.subject&&q.topic===attempt.topic)
        .slice(attempt.testIdx*15, attempt.testIdx*15+15);
    document.getElementById('review-back-text').innerText='Attempts';
    document.getElementById('review-title').innerText=attempt.topic+' · Test '+(attempt.testIdx+1)+' · '+attempt.date;
    renderReview(qs, attempt.responses, 'attempt');
    switchView('review');
}

function clearBlunders(){
    if(confirm('Clear all blunders? This cannot be undone.')) {
        AppState.blunders=[];
        saveState();
        renderDashboard('blunders');
    }
}

window.onload = goHome;
