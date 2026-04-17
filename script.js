/* ============================================================
   日录 · 个人成长追踪
   script.js
   ============================================================ */

const MOOD_MAP = {
  1: '低落 · 状态不佳',
  2: '一般 · 有些疲惫',
  3: '平稳 · 正常发挥',
  4: '不错 · 精力充沛',
  5: '极佳 · 状态巅峰',
};

// ─── Date Helpers ──────────────────────────────────────────
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `diary_${y}-${m}-${day}`;
}

function formatDate(key) {
  // key: diary_YYYY-MM-DD
  const s = key.replace('diary_', '');
  const [y, m, d] = s.split('-');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(`${y}-${m}-${d}`);
  return `${y} 年 ${m} 月 ${d} 日  周${weekdays[date.getDay()]}`;
}

function todayDisplay() {
  const d = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}  周${weekdays[d.getDay()]}`;
}

// ─── Storage Helpers ───────────────────────────────────────
function loadDay(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getAllDays() {
  const days = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('diary_')) days.push(k);
  }
  days.sort((a, b) => b.localeCompare(a)); // newest first
  return days;
}

// ─── State ─────────────────────────────────────────────────
let todos = []; // [{id, text, done}]
let mood = null; // 1-5
let exerciseTags = [];
let readingTags  = [];

// ─── Initialise ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('today-label').textContent = todayDisplay();
  loadTodayData();
  bindTextareas();
  bindMoodBtns();
  bindQuickTags();
  bindEnterOnTodoInput();
});

function loadTodayData() {
  const key  = todayKey();
  const data = loadDay(key);
  if (!data) return;

  // Textareas
  document.querySelectorAll('.card-textarea[data-key]').forEach(ta => {
    const k = ta.dataset.key;
    if (data[k] !== undefined) ta.value = data[k];
  });

  // Todos
  if (Array.isArray(data.todos)) {
    todos = data.todos;
    renderTodos();
  }

  // Mood
  if (data.mood) {
    mood = data.mood;
    highlightMood(mood);
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
}

// ─── Bind Textareas (auto-save on blur) ────────────────────
function bindTextareas() {
  document.querySelectorAll('.card-textarea[data-key]').forEach(ta => {
    ta.addEventListener('input', autoGrow);
    ta.addEventListener('blur', autosave);
    autoGrow.call(ta);
  });
}

function autoGrow() {
  this.style.height = 'auto';
  this.style.height = this.scrollHeight + 'px';
}

function autosave() {
  persistCurrentState();
}

// ─── Todo ──────────────────────────────────────────────────
function bindEnterOnTodoInput() {
  const inp = document.getElementById('todo-input');
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
  });
}

function addTodo() {
  const inp = document.getElementById('todo-input');
  const text = inp.value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  inp.value = '';
  renderTodos();
  persistCurrentState();
}

function toggleTodo(id) {
  const item = todos.find(t => t.id === id);
  if (item) item.done = !item.done;
  renderTodos();
  persistCurrentState();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  renderTodos();
  persistCurrentState();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'todo-check';
    chk.checked = todo.done;
    chk.addEventListener('change', () => toggleTodo(todo.id));

    const span = document.createElement('span');
    span.className = 'todo-text' + (todo.done ? ' done' : '');
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'todo-del';
    del.textContent = '×';
    del.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(chk);
    li.appendChild(span);
    li.appendChild(del);
    list.appendChild(li);
  });
}

// ─── Mood ──────────────────────────────────────────────────
function bindMoodBtns() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val);
      mood = val;
      highlightMood(val);
      persistCurrentState();
    });
  });
}

function highlightMood(val) {
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) === val);
  });
  const desc = document.getElementById('mood-desc');
  desc.textContent = MOOD_MAP[val] || '— 未选择 —';
}

// ─── Quick Tags ────────────────────────────────────────────
function bindQuickTags() {
  document.querySelectorAll('.qtag').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const val   = btn.dataset.val;

      if (group === 'exercise') {
        toggleTag(exerciseTags, val);
        syncTagUI('exercise', exerciseTags);
        appendTagToTextarea('exercise', val);
      } else if (group === 'reading') {
        toggleTag(readingTags, val);
        syncTagUI('reading', readingTags);
        appendTagToTextarea('reading', val);
      }
      persistCurrentState();
    });
  });
}

function toggleTag(arr, val) {
  const idx = arr.indexOf(val);
  if (idx === -1) arr.push(val);
  else arr.splice(idx, 1);
}

function syncTagUI(group, arr) {
  document.querySelectorAll(`.qtag[data-group="${group}"]`).forEach(btn => {
    btn.classList.toggle('active', arr.includes(btn.dataset.val));
  });
}

function appendTagToTextarea(key, val) {
  const ta = document.querySelector(`.card-textarea[data-key="${key}"]`);
  if (!ta) return;
  // If textarea is empty or doesn't already contain the val, append it
  if (!ta.value.includes(val)) {
    ta.value = ta.value ? ta.value + '、' + val : val;
    autoGrow.call(ta);
  }
}

// ─── Persist ───────────────────────────────────────────────
function collectCurrentState() {
  const data = { todos, mood, exerciseTags, readingTags };
  document.querySelectorAll('.card-textarea[data-key]').forEach(ta => {
    data[ta.dataset.key] = ta.value;
  });
  return data;
}

function persistCurrentState() {
  const data = collectCurrentState();
  saveToStorage(todayKey(), data);
}

// ─── Manual Save (with feedback) ──────────────────────────
function saveDay() {
  persistCurrentState();
  const status = document.getElementById('save-status');
  status.textContent = '✓ 已保存';
  clearTimeout(saveDay._timer);
  saveDay._timer = setTimeout(() => { status.textContent = ''; }, 2000);
}

// ─── History ───────────────────────────────────────────────
function toggleHistory() {
  const main = document.getElementById('main-view');
  const hist = document.getElementById('history-view');
  if (hist.classList.contains('hidden')) {
    renderHistory();
    main.classList.add('hidden');
    hist.classList.remove('hidden');
  } else {
    hist.classList.add('hidden');
    main.classList.remove('hidden');
  }
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const days = getAllDays().filter(k => k !== todayKey());

  if (days.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无历史记录</div>';
    return;
  }

  days.forEach(key => {
    const data = loadDay(key);
    if (!data) return;

    const entry = document.createElement('div');
    entry.className = 'history-entry';

    // Header row
    const header = document.createElement('div');
    header.className = 'history-entry-header';

    const dateEl = document.createElement('span');
    dateEl.className = 'history-date';
    dateEl.textContent = formatDate(key);

    const moodBadge = document.createElement('span');
    moodBadge.className = 'history-mood-badge';
    moodBadge.textContent = data.mood ? `情绪 ${data.mood}/5` : '情绪未记录';

    header.appendChild(dateEl);
    header.appendChild(moodBadge);

    // Preview
    const preview = document.createElement('div');
    preview.className = 'history-preview';
    const previewText = data.done || data.reflect || '（无摘要）';
    preview.textContent = previewText;

    // Detail (expandable)
    const detail = document.createElement('div');
    detail.className = 'history-detail';
    detail.innerHTML = buildDetailHTML(data);

    // Toggle
    entry.addEventListener('click', () => {
      detail.classList.toggle('open');
    });

    entry.appendChild(header);
    entry.appendChild(preview);
    entry.appendChild(detail);
    list.appendChild(entry);
  });
}

function buildDetailHTML(data) {
  const fields = [
    { label: '完成了什么', key: 'done' },
    { label: '反思复盘',   key: 'reflect' },
    { label: '今日难题',   key: 'problem' },
    { label: '运动记录',   key: 'exercise' },
    { label: '读书记录',   key: 'reading' },
    { label: '情绪备注',   key: 'mood-note' },
  ];

  let html = '<div class="history-detail-grid">';

  // Todos
  if (Array.isArray(data.todos) && data.todos.length > 0) {
    html += `<div class="history-field">
      <span class="history-field-label">时间计划</span>
      <div class="history-todo-list">`;
    data.todos.forEach(t => {
      html += `<div class="history-todo-item ${t.done ? 'done' : ''}">
        <div class="history-todo-dot"></div>
        <span>${escHtml(t.text)}</span>
      </div>`;
    });
    html += '</div></div>';
  }

  // Mood
  if (data.mood) {
    html += `<div class="history-field">
      <span class="history-field-label">情绪指数</span>
      <span class="history-field-value">${data.mood} / 5 · ${MOOD_MAP[data.mood]}</span>
    </div>`;
  }

  fields.forEach(f => {
    const val = data[f.key];
    if (val && val.trim()) {
      html += `<div class="history-field">
        <span class="history-field-label">${f.label}</span>
        <span class="history-field-value">${escHtml(val)}</span>
      </div>`;
    }
  });

  html += '</div>';
  return html;
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
