/* ==============================================
    目录 · 个人成长追踪 - 带Supabase云端版
============================================== */

// --- 1. Supabase 配置（这里替换成你的信息）---
const SUPABASE_URL = 'https://siahvguyjgjwqy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VWg6NTEG_1q3M9UdxRJqVQ_u7TK0j-L';

// 初始化 Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. 情绪映射 ---
const MOOD_MAP = {
    1: '低落 · 状态不佳',
    2: '一般 · 有些疲惫',
    3: '平稳 · 正常发挥',
    4: '不错 · 精力充沛',
    5: '极佳 · 状态巅峰',
};

// --- 3. 日期工具函数 ---
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${y}.${m}.${d} ${weekDays[date.getDay()]}`;
}

// --- 4. DOM 元素引用 ---
const elements = {
    loginSection: document.getElementById('login-section'),
    appSection: document.getElementById('app-section'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    logoutBtn: document.getElementById('logout-btn'),
    dateDisplay: document.getElementById('date-display'),
    // 模块输入框
    timeManagement: document.getElementById('time-management'),
    completed: document.getElementById('completed'),
    reflection: document.getElementById('reflection'),
    moodNotes: document.getElementById('mood-notes'),
    problems: document.getElementById('problems'),
    exercise: document.getElementById('exercise'),
    reading: document.getElementById('reading'),
    // 情绪按钮
    moodButtons: document.querySelectorAll('.mood-btn'),
    // 按钮
    addPlanBtn: document.getElementById('add-plan-btn'),
    saveBtn: document.getElementById('save-btn'),
    historyBtn: document.getElementById('history-btn'),
    // 历史记录
    historyModal: document.getElementById('history-modal'),
    historyContent: document.getElementById('history-content'),
    closeHistoryBtn: document.getElementById('close-history'),
};

// --- 5. 当前状态变量 ---
let currentUser = null;
let selectedMood = 3;
let todayRecord = null;

// --- 6. 认证相关函数 ---
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        showApp();
        loadTodayRecord();
    } else {
        showLogin();
    }
}

function showLogin() {
    elements.loginSection.style.display = 'block';
    elements.appSection.style.display = 'none';
}

function showApp() {
    elements.loginSection.style.display = 'none';
    elements.appSection.style.display = 'block';
    elements.dateDisplay.textContent = formatDate(todayKey());
}

async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert('登录失败：' + error.message);
    currentUser = data.user;
    showApp();
    loadTodayRecord();
}

async function register(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return alert('注册失败：' + error.message);
    alert('注册成功！请登录');
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    showLogin();
}

// --- 7. 数据操作函数 ---
async function loadTodayRecord() {
    const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('date', todayKey())
        .single();

    if (data) {
        todayRecord = data;
        fillForm(data);
    } else {
        todayRecord = null;
        clearForm();
    }
}

async function saveTodayRecord() {
    const record = {
        user_id: currentUser.id,
        date: todayKey(),
        time_management: elements.timeManagement.value,
        completed: elements.completed.value,
        reflection: elements.reflection.value,
        mood: selectedMood,
        mood_notes: elements.moodNotes.value,
        problems: elements.problems.value,
        exercise: elements.exercise.value,
        reading: elements.reading.value,
    };

    let error;
    if (todayRecord) {
        const { error: err } = await supabase
            .from('records')
            .update(record)
            .eq('id', todayRecord.id);
        error = err;
    } else {
        const { error: err } = await supabase.from('records').insert([record]);
        error = err;
    }

    if (error) {
        alert('保存失败：' + error.message);
    } else {
        alert('保存成功！');
        loadTodayRecord();
    }
}

async function loadHistoryRecords() {
    const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false });

    if (error) return alert('加载历史失败：' + error.message);
    renderHistory(data);
}

// --- 8. UI 辅助函数 ---
function fillForm(record) {
    elements.timeManagement.value = record.time_management || '';
    elements.completed.value = record.completed || '';
    elements.reflection.value = record.reflection || '';
    elements.moodNotes.value = record.mood_notes || '';
    elements.problems.value = record.problems || '';
    elements.exercise.value = record.exercise || '';
    elements.reading.value = record.reading || '';
    setMood(record.mood || 3);
}

function clearForm() {
    elements.timeManagement.value = '';
    elements.completed.value = '';
    elements.reflection.value = '';
    elements.moodNotes.value = '';
    elements.problems.value = '';
    elements.exercise.value = '';
    elements.reading.value = '';
    setMood(3);
}

function setMood(mood) {
    selectedMood = mood;
    elements.moodButtons.forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.mood) === mood);
    });
    document.getElementById('mood-label').textContent = MOOD_MAP[mood];
}

function renderHistory(records) {
    if (records.length === 0) {
        elements.historyContent.innerHTML = '<p>暂无历史记录</p>';
        return;
    }

    elements.historyContent.innerHTML = records.map(r => `
        <div class="history-item">
            <h4>${formatDate(r.date)}</h4>
            <p><strong>时间管理：</strong>${r.time_management || '无'}</p>
            <p><strong>今日完成：</strong>${r.completed || '无'}</p>
            <p><strong>复盘：</strong>${r.reflection || '无'}</p>
            <p><strong>情绪：</strong>${MOOD_MAP[r.mood]}</p>
            <hr>
        </div>
    `).join('');
}

// --- 9. 事件绑定 ---
elements.loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    login(email, password);
});

elements.registerForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    register(email, password);
});

elements.logoutBtn.addEventListener('click', logout);

elements.moodButtons.forEach(btn => {
    btn.addEventListener('click', () => setMood(parseInt(btn.dataset.mood)));
});

elements.addPlanBtn.addEventListener('click', () => {
    const list = elements.timeManagement.value;
    elements.timeManagement.value = list + (list ? '\n' : '') + '· ';
    elements.timeManagement.focus();
});

elements.saveBtn.addEventListener('click', saveTodayRecord);

elements.historyBtn.addEventListener('click', () => {
    loadHistoryRecords();
    elements.historyModal.style.display = 'block';
});

elements.closeHistoryBtn.addEventListener('click', () => {
    elements.historyModal.style.display = 'none';
});

// --- 10. 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    // 确保 Supabase 客户端已加载
    if (!window.supabase) {
        alert('Supabase 客户端未加载，请检查 index.html 中的 CDN 引入');
        return;
    }
    checkAuth();
});
