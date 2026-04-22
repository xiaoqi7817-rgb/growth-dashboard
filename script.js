/* ============================================================
   日录 · script.js  v2
   ============================================================ */

const SUPABASE_URL      = 'https://siahvguyjgjwqyznfhbr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYWh2Z3V5amdqd3F5em5maGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODUyNjIsImV4cCI6MjA5MTk2MTI2Mn0.FzQNHXEF9D1bgX9uFFInyzIA3rpP4ddXM9IPTcOCU5U';

const DAY_QUOTES = [
  '今天又是新的一页。','专注于你能掌控的事。','一小步，也是前进。',
  '感受此刻，记录此刻。','你的努力，都被记在这里。','慢慢来，比较快。',
  '今天你已经很不容易了。','把今天过好，就是对未来最好的投资。',
  '记录是一种看见自己的方式。','你今天的认真，是明天的底气。',
];

const TEMPLATES = {
  simple:  '【简单复盘】\n今天做了什么：\n\n结果如何：\n\n下次怎么做：',
  emotion: '【情绪复盘】\n什么引发了情绪：\n\n我是怎么回应的：\n\n我对自己的回应满意吗：',
  growth:  '【成长复盘】\n今天哪里突破了自己：\n\n哪里还在原地：\n\n明天想聚焦在：',
};

// ── State ────────────────────────────────────────────────────
let _sb          = null;
let currentUser  = null;
let isLocalMode  = false;
let appEntered   = false;

let todos        = [];
let moodWords    = [];
let exerciseTags = [];
let readingTags  = [];
let gratItems    = [];
let goals        = [];

// History
const histCache   = {};   // dayKey → data | null
let   histDays    = null; // [{key, date}] last 7 days
let   histLoaded  = false;

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  setDateDisplay();
  setDayQuote();
  bindTextareas();
  bindMoodWords();
  bindQuickTags();
  bindEnterKeys();
  bindVent();
});

function initSupabase() {
  try {
    if (SUPABASE_URL.includes('YOUR_PROJECT') || typeof window.supabase === 'undefined') return;
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    _sb.auth.onAuthStateChange((event, session) => {
      if (session?.user && !appEntered) { currentUser = session.user; enterApp(session.user); }
    });
    _sb.auth.getSession().then(({ data }) => {
      if (data.session?.user && !appEntered) { currentUser = data.session.user; enterApp(data.session.user); }
    });
  } catch(e) { _sb = null; }
}

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  setAuthMsg('');
}

function setAuthMsg(msg, isError = false) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function phoneToEmail(p) { return `${p.replace(/\D/g,'')}@phone.dailv`; }
function validatePhone(p) { return /^1[3-9]\d{9}$/.test(p.replace(/\s/g,'')); }

async function doLogin() {
  if (!_sb) { setAuthMsg('请配置 Supabase 或选择本地模式', true); return; }
  const phone = document.getElementById('login-phone').value.trim();
  const pwd   = document.getElementById('login-pwd').value;
  if (!phone || !pwd) { setAuthMsg('请填写手机号和密码', true); return; }
  if (!validatePhone(phone)) { setAuthMsg('请输入正确的手机号', true); return; }
  setAuthMsg('登录中…');
  const { data, error } = await _sb.auth.signInWithPassword({ email: phoneToEmail(phone), password: pwd });
  if (error) { setAuthMsg(friendlyError(error.message), true); return; }
  currentUser = data.user; enterApp(data.user);
}

async function doRegister() {
  if (!_sb) { setAuthMsg('请配置 Supabase 或选择本地模式', true); return; }
  const name  = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pwd   = document.getElementById('reg-pwd').value;
  if (!name || !phone || !pwd) { setAuthMsg('请填写所有字段', true); return; }
  if (!validatePhone(phone))   { setAuthMsg('请输入正确的手机号', true); return; }
  if (pwd.length < 6)          { setAuthMsg('密码至少 6 位', true); return; }
  setAuthMsg('注册中…');
  const { data, error } = await _sb.auth.signUp({
    email: phoneToEmail(phone), password: pwd,
    options: { data: { display_name: name, phone } },
  });
  if (error) { setAuthMsg(friendlyError(error.message), true); return; }
  if (data.user && !data.session) { setAuthMsg('✓ 注册成功！请返回登录。'); }
  else if (data.user) { currentUser = data.user; enterApp(data.user); }
}

async function doLogout() {
  if (_sb && !isLocalMode) await _sb.auth.signOut();
  currentUser = null; isLocalMode = false; appEntered = false;
  resetAppState();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

function useLocalMode() {
  isLocalMode = true;
  currentUser = { email: '本地', user_metadata: { display_name: '本地用户' } };
  enterApp(currentUser);
}

function friendlyError(msg) {
  if (msg.includes('Invalid login'))       return '手机号或密码错误';
  if (msg.includes('Email not confirmed')) return '请在 Supabase 关闭邮件验证';
  if (msg.includes('already registered'))  return '该手机号已注册，请直接登录';
  if (msg.includes('Password should be'))  return '密码至少 6 位';
  return msg;
}

// ══════════════════════════════════════════════════════════════
// ENTER APP
// ══════════════════════════════════════════════════════════════
function enterApp(user) {
  if (appEntered) return;
  appEntered = true;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const name = user?.user_metadata?.display_name || user?.email || '你好';
  document.getElementById('header-user').textContent = name;
  loadGoals();
  loadTodayData();
}

function resetAppState() {
  todos = []; moodWords = []; exerciseTags = []; readingTags = []; gratItems = [];
  document.querySelectorAll('.jtextarea').forEach(t => t.value = '');
  document.getElementById('vent-input').value = '';
  document.querySelectorAll('.mword,.qtag').forEach(b => b.classList.remove('active'));
  document.getElementById('todo-list').innerHTML = '';
  document.getElementById('grat-list').innerHTML = '';
  document.getElementById('goals-list').innerHTML = '';
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  histLoaded = false; histDays = null;
  Object.keys(histCache).forEach(k => delete histCache[k]);
}

// ══════════════════════════════════════════════════════════════
// DATE & QUOTE
// ══════════════════════════════════════════════════════════════
function todayKey() {
  const d = new Date();
  return `diary_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2,'0'); }

function setDateDisplay() {
  const d = new Date(), weeks = ['日','一','二','三','四','五','六'];
  document.getElementById('header-date').textContent =
    `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} 周${weeks[d.getDay()]}`;
  document.getElementById('day-greeting').textContent =
    d.getHours() < 12 ? '早上好' : d.getHours() < 18 ? '下午好' : '晚上好';
}

function setDayQuote() {
  document.getElementById('day-quote').textContent =
    DAY_QUOTES[new Date().getDate() % DAY_QUOTES.length];
}

// ══════════════════════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════════════════════
function sKey(dayKey) { return `${currentUser?.id || 'local'}_${dayKey}`; }

function localSave(dayKey, data) { localStorage.setItem(sKey(dayKey), JSON.stringify(data)); }

function localLoad(dayKey) {
  try { const r = localStorage.getItem(sKey(dayKey)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

async function remoteLoad(dayKey) {
  if (!_sb || isLocalMode) return localLoad(dayKey);
  try {
    const { data, error } = await _sb.from('diary_entries').select('content')
      .eq('user_id', currentUser.id).eq('entry_date', dayKey.replace('diary_','')).single();
    if (error || !data) return localLoad(dayKey);
    return data.content;
  } catch { return localLoad(dayKey); }
}

async function remoteSave(dayKey, content) {
  localSave(dayKey, content);
  if (!_sb || isLocalMode) return;
  try {
    await _sb.from('diary_entries').upsert(
      { user_id: currentUser.id, entry_date: dayKey.replace('diary_',''), content },
      { onConflict: 'user_id,entry_date' }
    );
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// LOAD TODAY
// ══════════════════════════════════════════════════════════════
async function loadTodayData() {
  const data = await remoteLoad(todayKey());
  if (!data) return;
  document.querySelectorAll('.jtextarea[data-key]').forEach(ta => {
    if (data[ta.dataset.key] !== undefined) { ta.value = data[ta.dataset.key]; autoGrow.call(ta); }
  });
  if (data.vent) { const v = document.getElementById('vent-input'); v.value = data.vent; autoGrowEl(v); }
  if (Array.isArray(data.todos))        { todos = data.todos; renderTodos(); }
  if (Array.isArray(data.moodWords))    {
    moodWords = data.moodWords;
    document.querySelectorAll('.mword').forEach(b =>
      b.classList.toggle('active', moodWords.includes(b.dataset.word)));
  }
  if (Array.isArray(data.exerciseTags)) { exerciseTags = data.exerciseTags; syncTagUI('exercise', exerciseTags); }
  if (Array.isArray(data.readingTags))  { readingTags  = data.readingTags;  syncTagUI('reading',  readingTags); }
  if (Array.isArray(data.gratItems))    { gratItems = data.gratItems; renderGrat(); }
}

// ══════════════════════════════════════════════════════════════
// COLLECT & PERSIST
// ══════════════════════════════════════════════════════════════
function collectState() {
  const data = { todos, moodWords, exerciseTags, readingTags, gratItems };
  document.querySelectorAll('.jtextarea[data-key]').forEach(ta => { data[ta.dataset.key] = ta.value; });
  data.vent = document.getElementById('vent-input')?.value || '';
  return data;
}

async function persistState() { await remoteSave(todayKey(), collectState()); }

// ══════════════════════════════════════════════════════════════
// PANELS — accordion
// ══════════════════════════════════════════════════════════════
async function togglePanel(panelId) {
  const panel = document.getElementById(`panel-${panelId}`);
  const wasOpen = panel.classList.contains('open');
  panel.classList.toggle('open');
  if (!wasOpen) {
    // Opening: render streak + history
    await ensureHistoryLoaded();
    renderStreak(panelId);
    renderPanelHistory(panelId);
  }
}

// ══════════════════════════════════════════════════════════════
// HISTORY
// ══════════════════════════════════════════════════════════════
async function ensureHistoryLoaded() {
  if (histLoaded) return;
  const days = [], now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    days.push({ key: `diary_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, date: d });
  }
  await Promise.all(days.map(async ({ key }) => { histCache[key] = await remoteLoad(key); }));
  histDays = days; histLoaded = true;
}

function panelHasContent(panelId, data) {
  if (!data) return false;
  switch(panelId) {
    case 'todo':      return !!(data.todos?.length);
    case 'done':      return !!(data.done?.trim() || data.reflect?.trim());
    case 'vitals':    return !!(data.moodWords?.length || data.exerciseTags?.length || data.readingTags?.length || data['mood-note']?.trim());
    case 'gratitude': return !!(data.gratItems?.length || data['gratitude-note']?.trim() || data['goal-today']?.trim());
    case 'moment':    return !!(data.moment?.trim() || data.problem?.trim());
  }
  return false;
}

function renderStreak(panelId) {
  const el = document.getElementById(`streak-${panelId}`);
  if (!el || !histDays) return;
  el.innerHTML = histDays.map(({ key }) => {
    const has = panelHasContent(panelId, histCache[key]);
    return `<span class="dot ${has ? 'dot-on' : 'dot-off'}"></span>`;
  }).join('');
}

function renderPanelHistory(panelId) {
  const el = document.getElementById(`hist-${panelId}`);
  if (!el || !histDays) return;
  const weeks = ['日','一','二','三','四','五','六'];
  let html = `<div class="hist-label">最近 7 天</div>`;
  histDays.forEach(({ key, date }) => {
    const data = histCache[key];
    const has  = panelHasContent(panelId, data);
    const ds   = `${pad(date.getMonth()+1)}.${pad(date.getDate())} 周${weeks[date.getDay()]}`;
    if (has) {
      html += `<div class="hist-item">
        <div class="hist-date" onclick="this.closest('.hist-item').classList.toggle('open')">
          <span>${ds}</span><span class="hdot hdot-on">●</span>
        </div>
        <div class="hist-content"><div class="hist-content-inner">${getPanelHistContent(panelId, data)}</div></div>
      </div>`;
    } else {
      html += `<div class="hist-item hist-empty">
        <div class="hist-date"><span>${ds}</span><span class="hdot hdot-off">○</span></div>
      </div>`;
    }
  });
  el.innerHTML = html;
}

function getPanelHistContent(panelId, data) {
  if (!data) return '';
  let h = '';
  switch(panelId) {
    case 'todo':
      h = (data.todos || []).map(t =>
        `<div class="hi-row${t.done?' hi-done':''}"><span>${t.done?'✓':'○'}</span><span>${esc(t.text)}</span></div>`
      ).join('');
      break;
    case 'done':
      if (data.done?.trim())    h += `<div class="hi-text">${esc(data.done)}</div>`;
      if (data.reflect?.trim()) h += `<div class="hi-text hi-dim">${esc(data.reflect)}</div>`;
      break;
    case 'vitals':
      if (data.moodWords?.length)     h += `<div class="hi-tags">${data.moodWords.join(' · ')}</div>`;
      if (data['mood-note']?.trim())  h += `<div class="hi-text">${esc(data['mood-note'])}</div>`;
      if (data.exerciseTags?.length)  h += `<div class="hi-tags">运动：${data.exerciseTags.join(' ')}</div>`;
      if (data.readingTags?.length)   h += `<div class="hi-tags">阅读：${data.readingTags.join(' ')}</div>`;
      break;
    case 'gratitude':
      h += (data.gratItems || []).map(g => `<div class="hi-row">♡ <span>${esc(g.text)}</span></div>`).join('');
      if (data['goal-today']?.trim()) h += `<div class="hi-text hi-dim">${esc(data['goal-today'])}</div>`;
      break;
    case 'moment':
      if (data.moment?.trim())  h += `<div class="hi-text">${esc(data.moment)}</div>`;
      if (data.problem?.trim()) h += `<div class="hi-text hi-dim">${esc(data.problem)}</div>`;
      break;
  }
  return h;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// ══════════════════════════════════════════════════════════════
// PANEL TABS & MODE SWITCHES
// ══════════════════════════════════════════════════════════════
function switchPanelTab(panelId, tab, btn) {
  const bd = document.getElementById(`bd-${panelId}`);
  bd.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  bd.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  document.getElementById(`${panelId}-${tab}`).classList.remove('hidden');
}

function setReflectMode(mode, btn) {
  document.querySelectorAll('#bd-done .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (mode === 'free') return;
  const ta = document.querySelector('.jtextarea[data-key="reflect"]');
  if (ta.value.trim() && !confirm('替换当前内容，使用模板？')) return;
  ta.value = TEMPLATES[mode]; autoGrow.call(ta); persistState();
}

function setMomentMode(mode, btn) {
  document.querySelectorAll('#bd-moment .msw').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pane-moment').classList.toggle('hidden', mode !== 'moment');
  document.getElementById('pane-problem').classList.toggle('hidden', mode !== 'problem');
}

// ══════════════════════════════════════════════════════════════
// PROMPT CHIPS
// ══════════════════════════════════════════════════════════════
function togglePrompts(key) {
  const el = document.getElementById(`prompts-${key}`);
  if (el) el.classList.toggle('hidden');
}

function usePrompt(key, chipEl) {
  const ta = document.querySelector(`.jtextarea[data-key="${key}"]`);
  if (!ta) return;
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n\n' : '';
  ta.value += `${sep}${chipEl.textContent.trim()}\n`;
  ta.focus(); ta.scrollTop = ta.scrollHeight;
  autoGrow.call(ta);
  chipEl.closest('.prompt-chips')?.classList.add('hidden');
  persistState();
}

// ══════════════════════════════════════════════════════════════
// TEXTAREAS
// ══════════════════════════════════════════════════════════════
function bindTextareas() {
  document.querySelectorAll('.jtextarea').forEach(ta => {
    ta.addEventListener('input', autoGrow);
    ta.addEventListener('blur', persistState);
    autoGrow.call(ta);
  });
}

function autoGrow() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; }
function autoGrowEl(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// ══════════════════════════════════════════════════════════════
// VENT BOX
// ══════════════════════════════════════════════════════════════
function bindVent() {
  const v = document.getElementById('vent-input');
  v.addEventListener('input', () => autoGrowEl(v));
  v.addEventListener('blur', async () => {
    await persistState();
    const s = document.getElementById('vent-status');
    s.textContent = '已保存';
    setTimeout(() => { s.textContent = ''; }, 1500);
  });
}

// ══════════════════════════════════════════════════════════════
// MOOD WORDS
// ══════════════════════════════════════════════════════════════
function bindMoodWords() {
  document.querySelectorAll('.mword').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word, idx = moodWords.indexOf(word);
      if (idx === -1) moodWords.push(word); else moodWords.splice(idx, 1);
      btn.classList.toggle('active', moodWords.includes(word));
      persistState();
    });
  });
}

// ══════════════════════════════════════════════════════════════
// QUICK TAGS
// ══════════════════════════════════════════════════════════════
function bindQuickTags() {
  document.querySelectorAll('.qtag').forEach(btn => {
    btn.addEventListener('click', () => {
      const { group, val } = btn.dataset;
      if (group === 'exercise') { toggleArr(exerciseTags, val); syncTagUI('exercise', exerciseTags); }
      if (group === 'reading')  { toggleArr(readingTags,  val); syncTagUI('reading',  readingTags); }
      persistState();
    });
  });
}

function toggleArr(arr, val) { const i = arr.indexOf(val); if (i===-1) arr.push(val); else arr.splice(i,1); }
function syncTagUI(group, arr) {
  document.querySelectorAll(`.qtag[data-group="${group}"]`).forEach(b =>
    b.classList.toggle('active', arr.includes(b.dataset.val)));
}

// ══════════════════════════════════════════════════════════════
// TODO
// ══════════════════════════════════════════════════════════════
function bindEnterKeys() {
  document.getElementById('todo-input').addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();addTodo();} });
  document.getElementById('grat-input').addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();addGrat();} });
}

function addTodo() {
  const inp = document.getElementById('todo-input'), text = inp.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false }); inp.value = '';
  renderTodos(); persistState();
}

function toggleTodo(id) {
  const item = todos.find(t => t.id === id); if (item) item.done = !item.done;
  renderTodos(); persistState();
}

function deleteTodo(id) { todos = todos.filter(t => t.id !== id); renderTodos(); persistState(); }

function renderTodos() {
  const list = document.getElementById('todo-list'); list.innerHTML = '';
  todos.forEach(todo => {
    const li = document.createElement('li'); li.className = 'todo-item';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = todo.done;
    chk.addEventListener('change', () => toggleTodo(todo.id));
    const span = document.createElement('span');
    span.className = `todo-text${todo.done?' done':''}`; span.textContent = todo.text;
    const del = document.createElement('button');
    del.className = 'todo-del'; del.textContent = '×'; del.addEventListener('click', () => deleteTodo(todo.id));
    li.append(chk, span, del); list.appendChild(li);
  });
}

// ══════════════════════════════════════════════════════════════
// GRATITUDE
// ══════════════════════════════════════════════════════════════
function addGrat() {
  const inp = document.getElementById('grat-input'), text = inp.value.trim();
  if (!text) return;
  gratItems.push({ id: Date.now(), text }); inp.value = '';
  renderGrat(); persistState();
}

function deleteGrat(id) { gratItems = gratItems.filter(g => g.id !== id); renderGrat(); persistState(); }

function renderGrat() {
  const list = document.getElementById('grat-list'); list.innerHTML = '';
  gratItems.forEach(g => {
    const li = document.createElement('li'); li.className = 'grat-item';
    const heart = document.createElement('span'); heart.className = 'grat-heart'; heart.textContent = '♡';
    const span  = document.createElement('span'); span.className = 'grat-text'; span.textContent = g.text;
    const del   = document.createElement('button'); del.className = 'grat-del'; del.textContent = '×';
    del.addEventListener('click', () => deleteGrat(g.id));
    li.append(heart, span, del); list.appendChild(li);
  });
}

// ══════════════════════════════════════════════════════════════
// GOALS
// ══════════════════════════════════════════════════════════════
function goalsKey() { return `${currentUser?.id || 'local'}_goals`; }
function loadGoals() {
  try { goals = JSON.parse(localStorage.getItem(goalsKey()) || '[]'); } catch { goals = []; }
  renderGoalsList();
}
function saveGoalsLocal() { localStorage.setItem(goalsKey(), JSON.stringify(goals)); }

function openGoalModal() {
  ['goal-name-input','goal-date-input','goal-why-input'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('goal-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name-input').focus(), 50);
}
function closeGoalModal() { document.getElementById('goal-modal').classList.add('hidden'); }
function closeGoalModalOutside(e) { if (e.target===document.getElementById('goal-modal')) closeGoalModal(); }

function saveGoal() {
  const name = document.getElementById('goal-name-input').value.trim(); if (!name) return;
  goals.push({ id: Date.now(), name,
    deadline: document.getElementById('goal-date-input').value || null,
    why: document.getElementById('goal-why-input').value.trim() || null });
  saveGoalsLocal(); closeGoalModal(); renderGoalsList();
}

function deleteGoal(id) {
  if (!confirm('确认删除这个目标？')) return;
  goals = goals.filter(g => g.id !== id); saveGoalsLocal(); renderGoalsList();
}

function renderGoalsList() {
  const c = document.getElementById('goals-list');
  if (!goals.length) { c.innerHTML = '<p class="goals-empty">还没有目标，点击下方添加</p>'; return; }
  c.innerHTML = '';
  goals.forEach(goal => {
    const card = document.createElement('div'); card.className = 'goal-card';
    let inner = `<div class="goal-card-top"><span class="goal-name">${esc(goal.name)}</span>`;
    if (goal.deadline) { const [,m,d] = goal.deadline.split('-'); inner += `<span class="goal-dl">${m}/${d}</span>`; }
    inner += `<button class="goal-del-btn" onclick="deleteGoal(${goal.id})">×</button></div>`;
    if (goal.why) inner += `<p class="goal-why">"${esc(goal.why)}"</p>`;
    card.innerHTML = inner; c.appendChild(card);
  });
}
