// ⚠️ अपना Worker URL यहाँ डालो
const API = 'https://quiz-api.YOUR-SUBDOMAIN.workers.dev';

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

function el(html) { return html; }
function $(id) { return document.getElementById(id); }

let currentTest = null;      // { attemptId, duration, questions }
let timerInterval = null;
let answers = {};

// ═══════ NAVBAR ═══════
function renderNav() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const navRight = $('navRight');
  const navHistory = $('navHistory');

  if (user) {
    navHistory.style.display = 'inline';
    navRight.innerHTML = `<span style="margin-right:10px">Hi, ${user.name}</span>
      <button onclick="logout()">Logout</button>`;
  } else {
    navHistory.style.display = 'none';
    navRight.innerHTML = `<a href="#" onclick="showPage('login')">Login</a>
      <a href="#" onclick="showPage('register')">Register</a>`;
  }
}

function logout() {
  localStorage.clear();
  renderNav();
  showPage('login');
}

// ═══════ ROUTER ═══════
function showPage(page) {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  if (!token && !['login', 'register'].includes(page)) page = 'login';

  switch (page) {
    case 'login':    renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'tests':    renderTests(); break;
    case 'history':  renderHistory(); break;
  }
  renderNav();
}

// ═══════ LOGIN PAGE ═══════
function renderLogin() {
  $('app').innerHTML = `
    <div class="container" style="max-width:400px">
      <div class="card">
        <h2>Login</h2>
        <div id="err" class="error"></div>
        <label>Email</label>
        <input id="email" type="email" />
        <label>Password</label>
        <input id="password" type="password" />
        <button onclick="doLogin()" style="width:100%">Login</button>
        <p style="margin-top:10px">New user? <a href="#" onclick="showPage('register')">Register</a></p>
      </div>
    </div>`;
}

async function doLogin() {
  const email = $('email').value;
  const password = $('password').value;
  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
    showPage('tests');
  } catch (e) {
    $('err').textContent = e.message;
  }
}

// ═══════ REGISTER PAGE ═══════
function renderRegister() {
  $('app').innerHTML = `
    <div class="container" style="max-width:400px">
      <div class="card">
        <h2>Register</h2>
        <div id="err" class="error"></div>
        <label>Name</label>
        <input id="name" />
        <label>Email</label>
        <input id="email" type="email" />
        <label>Password</label>
        <input id="password" type="password" />
        <button onclick="doRegister()" style="width:100%">Register</button>
        <p style="margin-top:10px">Already have account? <a href="#" onclick="showPage('login')">Login</a></p>
      </div>
    </div>`;
}

async function doRegister() {
  const name = $('name').value;
  const email = $('email').value;
  const password = $('password').value;
  try {
    const d = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    localStorage.setItem('token', d.token);
    localStorage.setItem('user', JSON.stringify(d.user));
    showPage('tests');
  } catch (e) {
    $('err').textContent = e.message;
  }
}

// ═══════ TEST LIST ═══════
async function renderTests() {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const tests = await api('/api/tests');
    let html = '<div class="container"><h2>Available Tests</h2>';
    if (tests.length === 0) html += '<p>No tests yet.</p>';
    tests.forEach(t => {
      html += `
        <div class="card">
          <h3>${t.title}</h3>
          <p>${t.description || ''}</p>
          <p style="font-size:13px;color:#666;margin-top:6px">
            ${t.section} | ${Math.floor(t.duration_seconds / 60)} min | Max ${t.max_attempts} attempts
          </p>
          <button class="mt-10" onclick="startTest('${t.id}')">Start Test</button>
        </div>`;
    });
    html += '</div>';
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

async function startTest(testId) {
  try {
    const d = await api(`/api/tests/${testId}/start`, { method: 'POST' });
    currentTest = d;
    answers = {};
    renderTestScreen();
  } catch (e) {
    alert(e.message);
  }
}

// ═══════ TEST SCREEN ═══════
function renderTestScreen() {
  const { questions, duration } = currentTest;
  let html = `<div class="container">
    <div class="timer" id="timer">⏱ --:--</div>`;

  questions.forEach((q, i) => {
    html += `
      <div class="card">
        <p style="font-weight:600;margin-bottom:12px">${i + 1}. ${q.question_text}</p>
        ${['A', 'B', 'C', 'D'].map(o => `
          <label class="option">
            <input type="radio" name="q_${q.id}" value="${o}"
              onchange="pick('${q.id}','${o}')" />
            <span><b>${o}.</b> ${q['option_' + o.toLowerCase()]}</span>
          </label>
        `).join('')}
      </div>`;
  });

  html += `<button class="btn-success" onclick="manualSubmit()"
    style="width:100%;padding:14px;font-size:16px">Submit Test</button></div>`;

  $('app').innerHTML = html;
  startTimer(duration);
}

function pick(qid, opt) { answers[qid] = opt; }

function startTimer(seconds) {
  let left = seconds;
  updateTimerDisplay(left);
  timerInterval = setInterval(() => {
    left--;
    updateTimerDisplay(left);
    if (left <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      submitTest(true);
    }
  }, 1000);
}

function updateTimerDisplay(s) {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const el = $('timer');
  if (el) el.textContent = `⏱ ${m}:${String(sec).padStart(2, '0')}`;
}

function manualSubmit() {
  if (!confirm('Submit test?')) return;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  submitTest(false);
}

// ═══════ SUBMIT ═══════
async function submitTest(isAuto) {
  const payload = {
    isAutoSubmit: isAuto,
    answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
      questionId, selectedOption
    }))
  };
  try {
    const d = await api(`/api/attempts/${currentTest.attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderResult(d);
  } catch (e) {
    alert(e.message);
  }
}

function renderResult(d) {
  $('app').innerHTML = `
    <div class="container">
      <div class="card">
        <h2>Result</h2>
        ${d.status === 'auto_submitted' ? '<p class="error">⏰ Time up — auto submitted</p>' : ''}
        <h1 style="color:${d.totalMarks >= 0 ? 'green' : 'red'};margin:10px 0">
          ${d.totalMarks.toFixed(2)} marks
        </h1>
        <p>✅ Correct: <b>${d.correct}</b></p>
        <p>❌ Wrong: <b>${d.wrong}</b></p>
        <p>⏭️ Skipped: <b>${d.unattempted}</b></p>
        <p>⏱ Time: <b>${Math.floor(d.timeTaken / 60)}m ${d.timeTaken % 60}s</b></p>
        <div class="mt-15">
          <button onclick="showPage('tests')">Home</button>
          <button class="btn-danger" onclick="showPage('history')" style="margin-left:8px">History</button>
        </div>
      </div>
    </div>`;
}

// ═══════ HISTORY ═══════
async function renderHistory() {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const list = await api('/api/history');
    let html = '<div class="container"><h2>History</h2>';
    if (list.length === 0) html += '<p>No attempts yet.</p>';
    else {
      html += `<div class="card" style="overflow-x:auto"><table>
        <thead><tr>
          <th>Test</th><th>Marks</th><th>✔</th><th>✘</th><th>Date</th><th></th>
        </tr></thead><tbody>`;
      list.forEach(a => {
        html += `<tr>
          <td>${a.title}</td>
          <td><b>${Number(a.total_marks).toFixed(2)}</b></td>
          <td>${a.correct_count}</td>
          <td>${a.wrong_count}</td>
          <td>${new Date(a.submitted_at + 'Z').toLocaleDateString()}</td>
          <td><a href="#" onclick="renderReview('${a.id}');return false">Review</a></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

// ═══════ REVIEW ═══════
async function renderReview(attemptId) {
  $('app').innerHTML = '<div class="container"><p>Loading...</p></div>';
  try {
    const list = await api(`/api/review/${attemptId}`);
    let html = '<div class="container"><h2>Review</h2>';
    list.forEach((a, i) => {
      const cls = a.is_correct === 1 ? 'result-correct'
                : a.is_correct === 0 ? 'result-wrong' : 'result-skip';
      html += `<div class="card ${cls}">
        <p style="font-weight:600;margin-bottom:8px">${i + 1}. ${a.question_text}</p>`;
      ['A', 'B', 'C', 'D'].forEach(o => {
        let mark = '';
        if (o === a.correct_option) mark = ' ✅';
        else if (o === a.selected_option) mark = ' ❌';
        html += `<div style="padding:6px 0"><b>${o}.</b> ${a['option_' + o.toLowerCase()]}${mark}</div>`;
      });
      if (a.explanation) html += `<p style="margin-top:8px;font-style:italic">💡 ${a.explanation}</p>`;
      html += '</div>';
    });
    html += `<button onclick="showPage('history')">← Back to History</button></div>`;
    $('app').innerHTML = html;
  } catch (e) {
    $('app').innerHTML = `<div class="container"><p class="error">${e.message}</p></div>`;
  }
}

// ═══════ INIT ═══════
showPage('tests');
