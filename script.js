/* ==============================================
    目录 · 个人成长追踪 - 带Supabase云端版
============================================== */

// --- 1. Supabase 配置（这里替换成你的信息）---
const SUPABASE_URL = 'https://siahvguyjgjwqy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VWg6NTEG_1q3M9UdxRJqVQ_u7TK0j-L';

// ── 每日励志/引导语 ──────────────────────────────────────────
const DAY_QUOTES = [
  '今天又是新的一页。',
  '专注于你能掌控的事。',
  '一小步，也是前进。',
  '感受此刻，记录此刻。',
  '你的努力，都被记在这里。',
  '慢慢来，比较快。',
  '今天你已经很不容易了。',
  '把今天过好，就是对未来最好的投资。',
  '记录是一种看见自己的方式。',
  '你今天的认真，是明天的底气。',
];

// ── 复盘模板 ────────────────────────────────────────────────
const TEMPLATES = {
  simple:  `【简单复盘】\n今天做了什么：\n\n结果如何：\n\n下次怎么做：`,
  emotion: `【情绪复盘】\n什么引发了情绪：\n\n我是怎么回应的：\n\n我对自己的回应满意吗：`,
  growth:  `【成长复盘】\n今天哪里突破了自己：\n\n哪里还在原地：\n\n明天想聚焦在：`,
};

// ── 状态 ────────────────────────────────────────────────────
let supabase = null;
let currentUser = null;
let isLocalMode = false;

let todos        = [];   // [{id, text, done}]
let moodWords    = [];   // string[]
let exerciseTags = [];
let readingTags  = [];
let gratItems    = [];   // [{id, text}]  感恩清单
let goals        = [];   // [{id, name, deadline, type, checkedDates, percentDates}]  目标（持久化到用户存储）
let goalTypeSelected = 'checkbox'; // modal内临时状态

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  setDateDisplay();
  setDayQuote();
  bindTextareas();
  bindMoodWords();
  bindQuickTags();
  bindEnterTodo();
  bindEnterGrat();
});

function initSupabase() {
  try {
    if (SUPABASE_URL.includes('YOUR_PROJECT')) {
      // 未配置，保持 Auth 界面，本地模式按钮可用
      return;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 监听 Auth 状态
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUser = session.user;
        enterApp(session.user);
      }
    });

    // 检查已有会话
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        currentUser = data.session.user;
        enterApp(data.session.user);
      }
    });
  } catch (e) {
    console.warn('Supabase init failed, local mode only:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
function switchTab(tab) {
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

async function doLogin() {
  if (!supabase) { setAuthMsg('请先配置 Supabase，或选择本地模式', true); return; }
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-pwd').value;
  if (!email || !pwd) { setAuthMsg('请填写邮箱和密码', true); return; }

  setAuthMsg('登录中…');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
  if (error) { setAuthMsg(friendlyError(error.message), true); return; }
  currentUser = data.user;
  enterApp(data.user);
}

async function doRegister() {
  if (!supabase) { setAuthMsg('请先配置 Supabase，或选择本地模式', true); return; }
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pwd   = document.getElementById('reg-pwd').value;
  if (!name || !email || !pwd) { setAuthMsg('请填写所有字段', true); return; }
  if (pwd.length < 6)          { setAuthMsg('密码至少 6 位', true); return; }

  setAuthMsg('注册中…');
  const { data, error } = await supabase.auth.signUp({
    email, password: pwd,
    options: { data: { display_name: name } },
  });
  if (error) { setAuthMsg(friendlyError(error.message), true); return; }

  if (data.user && !data.session) {
    setAuthMsg('✓ 注册成功！请去邮箱确认后再登录。');
  } else if (data.user) {
    currentUser = data.user;
    enterApp(data.user);
  }
}

async function doLogout() {
  if (supabase && !isLocalMode) await supabase.auth.signOut();
  currentUser = null;
  isLocalMode = false;
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
  if (msg.includes('Invalid login'))   return '邮箱或密码错误';
  if (msg.includes('Email not confirmed')) return '请先确认邮箱';
  if (msg.includes('already registered')) return '该邮箱已注册，请直接登录';
  return msg;
}

// ═══════════════════════════════════════════════════════════
// ENTER APP
// ═══════════════════════════════════════════════════════════
function enterApp(user) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const name = user?.user_metadata?.display_name || user?.email || '你好';
  document.getElementById('header-user').textContent = name;

  loadGoals();
  loadTodayData();
}

function resetAppState() {
  todos = []; moodWords = []; exerciseTags = []; readingTags = [];
  gratItems = [];
  document.querySelectorAll('.jtextarea').forEach(t => t.value = '');
  document.querySelectorAll('.mword').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.qtag').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('used'));
  document.getElementById('todo-list').innerHTML = '';
  document.getElementById('grat-list').innerHTML = '';
  document.getElementById('goals-list').innerHTML = '';
}

// ═══════════════════════════════════════════════════════════
// DATE & QUOTE
// ═══════════════════════════════════════════════════════════
function todayKey() {
  const d = new Date();
  return `diary_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function setDateDisplay() {
  const d = new Date();
  const weeks = ['日','一','二','三','四','五','六'];
  document.getElementById('header-date').textContent =
    `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}  周${weeks[d.getDay()]}`;

  const greet = d.getHours() < 12 ? '早上好' : d.getHours() < 18 ? '下午好' : '晚上好';
  document.getElementById('day-greeting').textContent = greet;
}

function setDayQuote() {
  const idx = new Date().getDate() % DAY_QUOTES.length;
  document.getElementById('day-quote').textContent = DAY_QUOTES[idx];
}

function formatDateFromKey(key) {
  const s = key.replace('diary_', '');
  const [y, m, d] = s.split('-');
  const weeks = ['日','一','二','三','四','五','六'];
  const w = new Date(`${y}-${m}-${d}`).getDay();
  return `${y} 年 ${m} 月 ${d} 日  周${weeks[w]}`;
}

// ═══════════════════════════════════════════════════════════
// STORAGE — localStorage (local mode) OR Supabase
// ═══════════════════════════════════════════════════════════
function storageKey(dayKey) {
  const uid = currentUser?.id || 'local';
  return `${uid}_${dayKey}`;
}

function localSave(dayKey, data) {
  localStorage.setItem(storageKey(dayKey), JSON.stringify(data));
}

function localLoad(dayKey) {
  try {
    const raw = localStorage.getItem(storageKey(dayKey));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function localAllKeys() {
  const uid = currentUser?.id || 'local';
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${uid}_diary_`)) keys.push(k.replace(`${uid}_`, ''));
  }
  keys.sort((a, b) => b.localeCompare(a));
  return keys;
}

async function remoteLoad(dayKey) {
  if (!supabase || isLocalMode) return localLoad(dayKey);
  try {
    const { data, error } = await supabase
      .from('diary_entries')
      .select('content')
      .eq('user_id', currentUser.id)
      .eq('entry_date', dayKey.replace('diary_', ''))
      .single();
    if (error || !data) return localLoad(dayKey); // fallback
    return data.content;
  } catch { return localLoad(dayKey); }
}

async function remoteSave(dayKey, content) {
  // Always save locally as cache/offline fallback
  localSave(dayKey, content);
  if (!supabase || isLocalMode) return true;
  try {
    const { error } = await supabase
      .from('diary_entries')
      .upsert({
        user_id:    currentUser.id,
        entry_date: dayKey.replace('diary_', ''),
        content,
      }, { onConflict: 'user_id,entry_date' });
    return !error;
  } catch { return false; }
}

async function remoteAllKeys() {
  if (!supabase || isLocalMode) return localAllKeys();
  try {
    const { data, error } = await supabase
      .from('diary_entries')
      .select('entry_date')
      .eq('user_id', currentUser.id)
      .order('entry_date', { ascending: false });
    if (error || !data) return localAllKeys();
    return data.map(r => `diary_${r.entry_date}`);
  } catch { return localAllKeys(); }
}

// ═══════════════════════════════════════════════════════════
// LOAD TODAY
// ═══════════════════════════════════════════════════════════
async function loadTodayData() {
  const data = await remoteLoad(todayKey());
  if (!data) return;

  // Textareas
  document.querySelectorAll('.jtextarea[data-key]').forEach(ta => {
    if (data[ta.dataset.key] !== undefined) {
      ta.value = data[ta.dataset.key];
      autoGrow.call(ta);
    }
  });

  // Todos
  if (Array.isArray(data.todos)) { todos = data.todos; renderTodos(); }

  // Mood words
  if (Array.isArray(data.moodWords)) {
    moodWords = data.moodWords;
    document.querySelectorAll('.mword').forEach(b => {
      b.classList.toggle('active', moodWords.includes(b.dataset.word));
    });
  }

  // Tags
  if (Array.isArray(data.exerciseTags)) {
    exerciseTags = data.exerciseTags;
    syncTagUI('exercise', exerciseTags);
  }
  if (Array.isArray(data.readingTags)) {
    readingTags = data.readingTags;
    syncTagUI('reading', readingTags);
  }

  // Gratitude
  if (Array.isArray(data.gratItems)) { gratItems = data.gratItems; renderGrat(); }

  // Goal today-checkins live inside diary day (checkbox/percent per goal per day)
  if (data.goalCheckins) renderGoalsWithCheckins(data.goalCheckins);
}

// ═══════════════════════════════════════════════════════════
// COLLECT & PERSIST
// ═══════════════════════════════════════════════════════════
function collectState() {
  const data = { todos, moodWords, exerciseTags, readingTags, gratItems };
  document.querySelectorAll('.jtextarea[data-key]').forEach(ta => {
    data[ta.dataset.key] = ta.value;
  });
  // Collect goal checkins
  data.goalCheckins = collectGoalCheckins();
  return data;
}

async function persistState() {
  await remoteSave(todayKey(), collectState());
}

// ═══════════════════════════════════════════════════════════
// TEXTAREA
// ═══════════════════════════════════════════════════════════
function bindTextareas() {
  document.querySelectorAll('.jtextarea').forEach(ta => {
    ta.addEventListener('input', autoGrow);
    ta.addEventListener('blur', persistState);
    autoGrow.call(ta);
  });
}

function autoGrow() {
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';
}

// ═══════════════════════════════════════════════════════════
// PROMPT CHIPS
// ═══════════════════════════════════════════════════════════
function insertPrompt(key, chipEl) {
  const ta = document.querySelector(`.jtextarea[data-key="${key}"]`);
  if (!ta) return;
  const q = chipEl.textContent.trim();
  chipEl.classList.add('used');
  // Append question as a new line prompt
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n\n' : '';
  ta.value += `${sep}${q}\n`;
  ta.focus();
  ta.scrollTop = ta.scrollHeight;
  autoGrow.call(ta);
  persistState();
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════
function applyTemplate(key, type) {
  const ta = document.querySelector(`.jtextarea[data-key="${key}"]`);
  if (!ta) return;
  if (ta.value.trim() && !confirm('替换当前内容，使用模板？')) return;
  ta.value = TEMPLATES[type] || '';
  ta.focus();
  autoGrow.call(ta);
  persistState();
}

// ═══════════════════════════════════════════════════════════
// MOOD WORDS
// ═══════════════════════════════════════════════════════════
function bindMoodWords() {
  document.querySelectorAll('.mword').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      const idx  = moodWords.indexOf(word);
      if (idx === -1) moodWords.push(word);
      else moodWords.splice(idx, 1);
      btn.classList.toggle('active', moodWords.includes(word));
      persistState();
    });
  });
}

// ═══════════════════════════════════════════════════════════
// QUICK TAGS
// ═══════════════════════════════════════════════════════════
function bindQuickTags() {
  document.querySelectorAll('.qtag').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const val   = btn.dataset.val;
      if (group === 'exercise') { toggleArr(exerciseTags, val); syncTagUI('exercise', exerciseTags); }
      if (group === 'reading')  { toggleArr(readingTags,  val); syncTagUI('reading',  readingTags);  }
      persistState();
    });
  });
}

function toggleArr(arr, val) {
  const i = arr.indexOf(val);
  if (i === -1) arr.push(val); else arr.splice(i, 1);
}

function syncTagUI(group, arr) {
  document.querySelectorAll(`.qtag[data-group="${group}"]`).forEach(b => {
    b.classList.toggle('active', arr.includes(b.dataset.val));
  });
}

// ═══════════════════════════════════════════════════════════
// TODO
// ═══════════════════════════════════════════════════════════
function bindEnterTodo() {
  document.getElementById('todo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
  });
}

function addTodo() {
  const inp  = document.getElementById('todo-input');
  const text = inp.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  inp.value = '';
  renderTodos();
  persistState();
}

function toggleTodo(id) {
  const item = todos.find(t => t.id === id);
  if (item) item.done = !item.done;
  renderTodos();
  persistState();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  renderTodos();
  persistState();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  todos.forEach(todo => {
    const li  = document.createElement('li');
    li.className = 'todo-item';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'todo-check';
    chk.checked = todo.done;
    chk.addEventListener('change', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = `todo-text${todo.done ? ' done' : ''}`;
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'todo-del';
    del.textContent = '×';
    del.addEventListener('click', () => deleteTodo(todo.id));

    li.append(chk, span, del);
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════
// SAVE BUTTON
// ═══════════════════════════════════════════════════════════
async function saveDay() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  await persistState();
  btn.disabled = false;
  const s = document.getElementById('save-status');
  s.textContent = '✓ 已保存';
  clearTimeout(saveDay._t);
  saveDay._t = setTimeout(() => { s.textContent = ''; }, 2000);
}

// ═══════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════
let historyOpen = false;

function toggleHistory() {
  historyOpen = !historyOpen;
  document.getElementById('main-view').classList.toggle('hidden', historyOpen);
  document.getElementById('history-view').classList.toggle('hidden', !historyOpen);
  if (historyOpen) renderHistory();
}

async function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="h-empty">加载中…</div>';

  const keys = (await remoteAllKeys()).filter(k => k !== todayKey());

  if (!keys.length) {
    list.innerHTML = '<div class="h-empty">暂无历史记录，继续每天坚持吧 :)</div>';
    return;
  }

  list.innerHTML = '';

  for (const key of keys) {
    const data = await (supabase && !isLocalMode ? remoteLoad(key) : Promise.resolve(localLoad(key)));
    if (!data) continue;

    const entry = document.createElement('div');
    entry.className = 'h-entry';

    const top = document.createElement('div');
    top.className = 'h-entry-top';

    const dateEl = document.createElement('span');
    dateEl.className = 'h-date';
    dateEl.textContent = formatDateFromKey(key);

    const moodBadge = document.createElement('span');
    moodBadge.className = 'h-mood-words';
    moodBadge.textContent = Array.isArray(data.moodWords) && data.moodWords.length
      ? data.moodWords.join(' · ')
      : '情绪未记录';

    top.append(dateEl, moodBadge);

    const preview = document.createElement('div');
    preview.className = 'h-preview';
    preview.textContent = data.done || data.moment || data.reflect || '（无内容摘要）';

    const detail = document.createElement('div');
    detail.className = 'h-detail';
    detail.innerHTML = buildDetailHTML(data);

    entry.addEventListener('click', () => detail.classList.toggle('open'));

    entry.append(top, preview, detail);
    list.appendChild(entry);
  }
}

const FIELD_LABELS = [
  { key: 'done',          label: '今天，我做到了'   },
  { key: 'reflect',       label: '回头看看今天'     },
  { key: 'moment',        label: '今天最深的那一刻' },
  { key: 'problem',       label: '卡住我的事'       },
  { key: 'exercise',      label: '身体动起来了吗'   },
  { key: 'reading',       label: '今天读了什么'     },
  { key: 'mood-note',     label: '情绪故事'         },
  { key: 'gratitude-note',label: '感恩随笔'         },
  { key: 'goal-today',    label: '今天为目标做了什么' },
];

function buildDetailHTML(data) {
  let html = '<div class="h-grid">';

  // Todos
  if (Array.isArray(data.todos) && data.todos.length) {
    html += `<div class="h-field"><div class="h-field-label">今天的安排</div><div class="h-todo-list">`;
    data.todos.forEach(t => {
      html += `<div class="h-todo-item${t.done?' done':''}">
        <div class="h-todo-dot"></div><span>${esc(t.text)}</span></div>`;
    });
    html += '</div></div>';
  }

  // Gratitude items
  if (Array.isArray(data.gratItems) && data.gratItems.length) {
    html += `<div class="h-field"><div class="h-field-label">今天，我感谢……</div><div class="h-todo-list">`;
    data.gratItems.forEach(g => {
      html += `<div class="h-todo-item"><div class="h-todo-dot"></div><span>${esc(g.text)}</span></div>`;
    });
    html += '</div></div>';
  }

  // Mood words
  if (Array.isArray(data.moodWords) && data.moodWords.length) {
    html += `<div class="h-field">
      <div class="h-field-label">今天的心情</div>
      <div class="h-field-value">${data.moodWords.join(' · ')}</div>
    </div>`;
  }

  FIELD_LABELS.forEach(({ key, label }) => {
    const val = data[key];
    if (val?.trim()) {
      html += `<div class="h-field">
        <div class="h-field-label">${label}</div>
        <div class="h-field-value">${esc(val)}</div>
      </div>`;
    }
  });

  html += '</div>';
  return html;
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════════
// GRATITUDE LIST
// ═══════════════════════════════════════════════════════════
function bindEnterGrat() {
  document.getElementById('grat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addGrat(); }
  });
}

function insertPromptAndFocusList(key, chipEl) {
  insertPrompt(key, chipEl);
  // Also focus the list input for quick entry
  document.getElementById('grat-input').focus();
}

function addGrat() {
  const inp  = document.getElementById('grat-input');
  const text = inp.value.trim();
  if (!text) return;
  gratItems.push({ id: Date.now(), text });
  inp.value = '';
  renderGrat();
  persistState();
}

function deleteGrat(id) {
  gratItems = gratItems.filter(g => g.id !== id);
  renderGrat();
  persistState();
}

function renderGrat() {
  const list = document.getElementById('grat-list');
  list.innerHTML = '';
  gratItems.forEach(g => {
    const li = document.createElement('li');
    li.className = 'grat-item';

    const heart = document.createElement('span');
    heart.className = 'grat-heart';
    heart.textContent = '♡';

    const span = document.createElement('span');
    span.className = 'grat-text';
    span.textContent = g.text;

    const del = document.createElement('button');
    del.className = 'grat-del';
    del.textContent = '×';
    del.addEventListener('click', () => deleteGrat(g.id));

    li.append(heart, span, del);
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════
// GOALS — 纯文字记录，简洁版
// ═══════════════════════════════════════════════════════════
function goalsStorageKey() {
  const uid = currentUser?.id || 'local';
  return `${uid}_goals`;
}

function loadGoals() {
  try {
    const raw = localStorage.getItem(goalsStorageKey());
    goals = raw ? JSON.parse(raw) : [];
  } catch { goals = []; }
  renderGoalsList();
}

function saveGoalsToStorage() {
  localStorage.setItem(goalsStorageKey(), JSON.stringify(goals));
}

function openGoalModal() {
  document.getElementById('goal-name-input').value = '';
  document.getElementById('goal-date-input').value = '';
  document.getElementById('goal-why-input').value = '';
  document.getElementById('goal-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('goal-name-input').focus(), 50);
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
}

function closeGoalModalOutside(e) {
  if (e.target === document.getElementById('goal-modal')) closeGoalModal();
}

function saveGoal() {
  const name = document.getElementById('goal-name-input').value.trim();
  if (!name) { document.getElementById('goal-name-input').focus(); return; }
  const deadline = document.getElementById('goal-date-input').value || null;
  const why      = document.getElementById('goal-why-input').value.trim() || null;
  goals.push({ id: Date.now(), name, deadline, why });
  saveGoalsToStorage();
  closeGoalModal();
  renderGoalsList();
}

function deleteGoal(id) {
  if (!confirm('确认删除这个目标？')) return;
  goals = goals.filter(g => g.id !== id);
  saveGoalsToStorage();
  renderGoalsList();
}

function renderGoalsList() {
  const container = document.getElementById('goals-list');
  container.innerHTML = '';

  if (!goals.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'font-family:var(--mono);font-size:0.68rem;color:var(--text-faint);padding:0.3rem 0 0.8rem;letter-spacing:0.05em;';
    empty.textContent = '还没有设定目标，点击下方添加';
    container.appendChild(empty);
    return;
  }

  goals.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'goal-card';

    const top = document.createElement('div');
    top.className = 'goal-card-top';

    const nameEl = document.createElement('span');
    nameEl.className = 'goal-name';
    nameEl.textContent = goal.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'goal-del-btn';
    delBtn.textContent = '×';
    delBtn.title = '删除目标';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteGoal(goal.id); });

    top.append(nameEl);

    if (goal.deadline) {
      const dl = document.createElement('span');
      dl.className = 'goal-deadline';
      // Format date nicely
      const [y, m, d] = goal.deadline.split('-');
      dl.textContent = `${m}/${d} 截止`;
      top.append(dl);
    }

    top.append(delBtn);
    card.appendChild(top);

    if (goal.why) {
      const why = document.createElement('p');
      why.className = 'goal-why';
      why.textContent = `"${goal.why}"`;
      card.appendChild(why);
    }

    container.appendChild(card);
  });
}

// collectGoalCheckins no longer needed (text-only), keep stub for collectState compatibility
function collectGoalCheckins() { return {}; }
function renderGoalsWithCheckins() { renderGoalsList(); }
