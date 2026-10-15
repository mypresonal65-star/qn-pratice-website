// ⚠️ अपना Worker URL यहाँ डालो (user app जैसा ही)
const API = 'https://quize-pratice.bot41059.workers.dev';

// ═══════ HELPERS ═══════
async function api(path, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}
function $(id) { return document.getElementById(id); }

// ═══════ NAVBAR ═══════
function renderNav() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  $('navRight').innerHTML = user
    ? `<span style="margin-right:10px">👤 ${user.name}</span>
       <button onclick="logout()">Logout</button>`
    : '';
}
function logout() { localStorage.clear(); showAdminPage('login'); }

// ═══════ ROUTER ═══════
function showAdminPage(page) {
  const token = localStorage.getItem('token');
  if (!token && page !== 'login') page = 'login';

  switch (page) {
    case 'login':     renderLogin(); break;
    case 'dashboard': renderDashboard(); break;
    case 'tests':     renderTests(); break;
  }
  renderNav();
}

// ═══════ LOGIN ═══════
function renderLogin() {
  $('app').innerHTML = `
    <div class="container" style="max-width:400px">
      <div class="card">
        <h2>Admin Login</h2>
        <div id="err" class="error"></div>
        <label>Email</label>
        <input id="email" type="email" />
        <label>Password</label>
        <input id="password" type="password" />
        <button onclick="doLogin()" style="width:100%">Login</button>
      </div>
    </div>`;
}

async function doLogin() {
  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value })
    });
    if (d.user.role !== 'admin') return $('err').textContent = 'Not an admin';
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
    showAdminPage('dashboard');
  } catch (e) { $('err').textContent = e.message; }
}

// ═══════ DASHBOARD ═══════
async function renderDashboard() {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const d = await api('/api/admin/analytics');
    let html = `<div class="container">
      <h2>Dashboard</h2>
      <div class="grid-2">
        <div class="card"><h3>Total Users</h3><h1>${d.totalUsers}</h1></div>
        <div class="card"><h3>Total Attempts</h3><h1>${d.totalAttempts}</h1></div>
      </div>
      <div class="card">
        <h3>Tests Overview</h3>
        <table>
          <thead><tr><th>Test</th><th>Section</th><th>Attempts</th><th>Avg</th></tr></thead>
          <tbody>`;
    d.perTest.forEach(t => {
      html += `<tr>
        <td>${t.title}</td>
        <td>${t.section}</td>
        <td>${t.attempts}</td>
        <td>${t.avg_marks ? Number(t.avg_marks).toFixed(2) : '0'}</td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

// ═══════ TESTS LIST ═══════
async function renderTests() {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const list = await api('/api/admin/tests');
    let html = `<div class="container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h2>Tests</h2>
        <button onclick="renderTestForm()">+ New Test</button>
      </div>`;
    if (list.length === 0) html += '<p>No tests. Create one!</p>';
    list.forEach(t => {
      html += `<div class="card">
        <h3>${t.title}</h3>
        <p>${t.description || ''}</p>
        <p style="font-size:13px;color:#666;margin-top:6px">
          ${t.section} | ${Math.floor(t.duration_seconds / 60)}min |
          Max ${t.max_attempts} | ${t.is_active ? '✅ Active' : '❌ Inactive'}
        </p>
        <div class="mt-10 row">
          <button class="btn-small" onclick="renderQuestions('${t.id}')">Questions</button>
          <button class="btn-small" onclick="renderTestForm('${t.id}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteTest('${t.id}')">Delete</button>
        </div>
      </div>`;
    });
    html += '</div>';
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

async function deleteTest(id) {
  if (!confirm('Delete this test and all its questions?')) return;
  await api(`/api/admin/tests/${id}`, { method: 'DELETE' });
  renderTests();
}

// ═══════ TEST FORM ═══════
async function renderTestForm(id) {
  let t = { title: '', description: '', section: 'math', duration_seconds: 1800,
            max_attempts: 1, is_active: 1 };
  if (id) {
    const list = await api('/api/admin/tests');
    t = list.find(x => x.id === id) || t;
  }

  $('app').innerHTML = `
    <div class="container" style="max-width:600px">
      <div class="card">
        <h2>${id ? 'Edit' : 'New'} Test</h2>
        <div id="err" class="error"></div>
        <label>Title</label>
        <input id="title" value="${t.title}" />
        <label>Description</label>
        <input id="description" value="${t.description || ''}" />
        <label>Section</label>
        <select id="section">
          ${['math', 'reasoning', 'quant', 'english'].map(s =>
            `<option value="${s}" ${s === t.section ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
        <label>Duration (seconds)</label>
        <input id="duration_seconds" type="number" value="${t.duration_seconds}" />
        <label>Max Attempts</label>
        <input id="max_attempts" type="number" value="${t.max_attempts}" />
        <label>Status</label>
        <select id="is_active">
          <option value="1" ${t.is_active == 1 ? 'selected' : ''}>Active</option>
          <option value="0" ${t.is_active == 0 ? 'selected' : ''}>Inactive</option>
        </select>
        <button onclick="saveTest('${id || ''}')" style="width:100%">Save</button>
        <button onclick="showAdminPage('tests')" class="mt-10" style="width:100%;background:#6b7280">Cancel</button>
      </div>
    </div>`;
}

async function saveTest(id) {
  const body = {
    title: $('title').value,
    description: $('description').value,
    section: $('section').value,
    duration_seconds: +$('duration_seconds').value,
    max_attempts: +$('max_attempts').value,
    is_active: +$('is_active').value
  };
  try {
    if (id) await api(`/api/admin/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/tests', { method: 'POST', body: JSON.stringify(body) });
    showAdminPage('tests');
  } catch (e) { $('err').textContent = e.message; }
}

// ═══════ QUESTIONS LIST ═══════
async function renderQuestions(testId) {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const list = await api(`/api/admin/tests/${testId}/questions`);
    let html = `<div class="container">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h2>Questions (${list.length})</h2>
        <button onclick="renderQuestionForm('${testId}')">+ Add Question</button>
      </div>
      <button onclick="showAdminPage('tests')" style="background:#6b7280;margin-bottom:15px">← Back</button>`;
    list.forEach((q, i) => {
      html += `<div class="card">
        <p style="font-weight:600">${i + 1}. ${q.question_text}</p>
        <div style="font-size:13px;margin-top:6px">
          <div>A. ${q.option_a}</div>
          <div>B. ${q.option_b}</div>
          <div>C. ${q.option_c}</div>
          <div>D. ${q.option_d}</div>
        </div>
        <p style="color:green;margin-top:6px">
          ✅ ${q.correct_option} | +${q.marks_correct} / ${q.marks_wrong}
        </p>
        <div class="mt-10 row">
          <button class="btn-small" onclick="renderQuestionForm('${testId}', '${q.id}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteQuestion('${q.id}', '${testId}')">Delete</button>
        </div>
      </div>`;
    });
    html += '</div>';
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

async function deleteQuestion(qid, testId) {
  if (!confirm('Delete this question?')) return;
  await api(`/api/admin/questions/${qid}`, { method: 'DELETE' });
  renderQuestions(testId);
}

// ═══════ QUESTION FORM ═══════
async function renderQuestionForm(testId, qid) {
  let q = {
    question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_option: 'A', marks_correct: 1, marks_wrong: -0.25, explanation: '', order_index: 0
  };
  if (qid) {
    const list = await api(`/api/admin/tests/${testId}/questions`);
    q = list.find(x => x.id === qid) || q;
  }

  $('app').innerHTML = `
    <div class="container" style="max-width:700px">
      <div class="card">
        <h2>${qid ? 'Edit' : 'Add'} Question</h2>
        <div id="err" class="error"></div>
        <label>Question</label>
        <textarea id="question_text">${q.question_text}</textarea>
        ${['a', 'b', 'c', 'd'].map(o => `
          <label>Option ${o.toUpperCase()}</label>
          <input id="option_${o}" value="${q['option_' + o]}" />
        `).join('')}
        <label>Correct Option</label>
        <select id="correct_option">
          ${['A', 'B', 'C', 'D'].map(o =>
            `<option ${o === q.correct_option ? 'selected' : ''}>${o}</option>`
          ).join('')}
        </select>
        <div class="grid-2">
          <div>
            <label>Marks (Correct)</label>
            <input id="marks_correct" type="number" step="0.01" value="${q.marks_correct}" />
          </div>
          <div>
            <label>Marks (Wrong)</label>
            <input id="marks_wrong" type="number" step="0.01" value="${q.marks_wrong}" />
          </div>
        </div>
        <label>Explanation (optional)</label>
        <textarea id="explanation">${q.explanation || ''}</textarea>
        <label>Order</label>
        <input id="order_index" type="number" value="${q.order_index || 0}" />
        <button onclick="saveQuestion('${testId}', '${qid || ''}')" style="width:100%">Save</button>
        <button onclick="renderQuestions('${testId}')" class="mt-10" style="width:100%;background:#6b7280">Cancel</button>
      </div>
    </div>`;
}

async function saveQuestion(testId, qid) {
  const body = {
    question_text: $('question_text').value,
    option_a: $('option_a').value,
    option_b: $('option_b').value,
    option_c: $('option_c').value,
    option_d: $('option_d').value,
    correct_option: $('correct_option').value,
    marks_correct: +$('marks_correct').value,
    marks_wrong: +$('marks_wrong').value,
    explanation: $('explanation').value,
    order_index: +$('order_index').value
  };
  try {
    if (qid) await api(`/api/admin/questions/${qid}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api(`/api/admin/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(body) });
    renderQuestions(testId);
  } catch (e) { $('err').textContent = e.message; }
}

// ═══════ INIT ═══════
showAdminPage('dashboard');
