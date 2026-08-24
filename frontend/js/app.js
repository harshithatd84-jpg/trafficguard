/* ═══════════════════════════════════════════════
   TrafficGuard AI v2 — app.js
   Full featured: Predict, Dashboard, Map, Models,
   History, Upload, Export, Auth, i18n, Theme
═══════════════════════════════════════════════ */
const API = '';
let charts = {};
let lastResult = null;
let historyData = [];
let sidebarCollapsed = false;

/* ─── INIT ─────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  // Apply saved lang
  setLanguage(currentLang);

  // Apply saved theme
  if (localStorage.getItem('tg_theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('darkModeToggle').classList.remove('on');
  }

  // Run loader
  await runLoader();

  // Kick off async setup
  checkAPI();
  loadOptions();
  checkAuth();
  onHourChange(8);
});

/* ─── LOADER ────────────────────────────────────── */
async function runLoader() {
  const steps = [
    { msg: 'Connecting to API…',      pct: 15 },
    { msg: 'Loading ML artifacts…',   pct: 35 },
    { msg: 'Fetching dataset stats…', pct: 55 },
    { msg: 'Rendering charts…',       pct: 75 },
    { msg: 'Preparing interface…',    pct: 90 },
    { msg: 'Ready! 🚀',               pct: 100 },
  ];
  const fill = document.getElementById('loaderFill');
  const msg  = document.getElementById('loaderMsg');
  const pct  = document.getElementById('loaderPct');

  for (const step of steps) {
    fill.style.width = step.pct + '%';
    pct.textContent  = step.pct + '%';
    msg.textContent  = step.msg;
    await sleep(380);
  }
  await sleep(200);
  document.getElementById('loader').classList.add('gone');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ─── API STATUS ────────────────────────────────── */
async function checkAPI() {
  const badge = document.getElementById('apiBadge');
  const text  = document.getElementById('apiText');
  try {
    const r = await fetch(`${API}/`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      badge.className = 'api-badge online';
      text.textContent = 'ONLINE';
    } else throw new Error();
  } catch {
    badge.className = 'api-badge offline';
    text.textContent = 'OFFLINE';
  }
}

/* ─── NAVIGATION ────────────────────────────────── */
function showPage(name, linkEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  const titles = {
    predict:  ['Predict', '— Severity Analysis'],
    dashboard:['Dashboard', '— Analytics & Insights'],
    map:      ['Hotspot Map', '— Bangalore Accident Zones'],
    models:   ['ML Models', '— Performance Comparison'],
    history:  ['History', '— Past Predictions'],
    upload:   ['Upload Data', '— Analyze Your CSV'],
    settings: ['Settings', '— Preferences'],
  };
  const [title, sub] = titles[name] || ['TrafficGuard AI', ''];
  document.getElementById('topbarTitle').innerHTML =
    `${title} <span>${sub}</span>`;

  // Lazy load data for specific pages
  if (name === 'dashboard') loadDashboard();
  if (name === 'models')    loadModels();
  if (name === 'history')   loadHistory();
  if (name === 'map')       renderMap();
  if (name === 'settings')  loadSettings();

  // Close mobile sidebar
  if (window.innerWidth <= 900)
    document.getElementById('sidebar').classList.remove('mobile-open');
}

/* ─── SIDEBAR ───────────────────────────────────── */
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('sidebarToggle').textContent = sidebarCollapsed ? '▶' : '◀';
}
function toggleMobile() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

/* ─── THEME ─────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('tg_theme', isLight ? 'light' : 'dark');
  document.getElementById('darkModeToggle').classList.toggle('on', !isLight);
  // Update charts on theme change
  Object.values(charts).forEach(c => { try { c.update(); } catch {} });
}

/* ─── AUTH ──────────────────────────────────────── */
function openAuth()  { document.getElementById('authModal').classList.add('open'); }
function closeAuth() { document.getElementById('authModal').classList.remove('open'); }

function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display    = tab==='login'    ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab==='register' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab==='login');
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPwd').value;
  const err   = document.getElementById('loginErr');
  err.className = 'form-error';

  if (!email || !pwd) { err.textContent = 'Fill all fields'; err.className='form-error show'; return; }

  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method:'POST', headers:getHeaders(),
      body: JSON.stringify({email, password: pwd}),
    });
    const d = await r.json();
    if (!r.ok) { err.textContent = d.error; err.className='form-error show'; return; }
    setCurrentUser(d.user);
    closeAuth();
    toast('success', `Welcome back, ${d.user.name}! 👋`);
  } catch {
    // Offline demo mode
    const demoUser = { name: 'Demo User', email };
    setCurrentUser(demoUser);
    closeAuth();
    toast('info', 'Running in demo mode (API offline)');
  }
}

async function doRegister() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pwd   = document.getElementById('regPwd').value;
  const err   = document.getElementById('regErr');
  const ok    = document.getElementById('regOk');
  err.className='form-error'; ok.className='form-success';

  if (!name||!email||!pwd) { err.textContent='Fill all fields'; err.className='form-error show'; return; }
  if (pwd.length < 6)       { err.textContent='Password min 6 chars'; err.className='form-error show'; return; }

  try {
    const r = await fetch(`${API}/api/auth/register`, {
      method:'POST', headers:getHeaders(),
      body: JSON.stringify({name, email, password:pwd}),
    });
    const d = await r.json();
    if (!r.ok) { err.textContent=d.error; err.className='form-error show'; return; }
    setCurrentUser(d.user);
    closeAuth();
    toast('success', `Account created! Welcome ${d.user.name} 🎉`);
  } catch {
    const demoUser = {name, email};
    setCurrentUser(demoUser);
    closeAuth();
    toast('info', 'Registered in demo mode');
  }
}

async function checkAuth() {
  try {
    const r = await fetch(`${API}/api/auth/me`, {headers: getHeaders()});
    const d = await r.json();
    if (d.user) setCurrentUser(d.user);
    else {
      // Try demo user from localStorage
      const saved = localStorage.getItem('tg_demo_user');
      if (saved) setCurrentUser(JSON.parse(saved));
    }
  } catch {
    const saved = localStorage.getItem('tg_demo_user');
    if (saved) setCurrentUser(JSON.parse(saved));
  }
  // Init demo user
  if (!localStorage.getItem('tg_demo_user')) {
    localStorage.setItem('tg_demo_init', '1');
  }
}

function setCurrentUser(user) {
  localStorage.setItem('tg_demo_user', JSON.stringify(user));
  document.getElementById('userPill').style.display = 'flex';
  document.getElementById('userNameDisplay').textContent = user.name.split(' ')[0];
  document.getElementById('userAvatar').textContent = user.name[0].toUpperCase();
  document.getElementById('authNavLabel').textContent = user.name.split(' ')[0];
}

// Returns headers with user email for backend auth (no cookies needed)
function getHeaders(extra) {
  extra = extra || {};
  var saved = localStorage.getItem('tg_demo_user');
  var user  = saved ? JSON.parse(saved) : null;
  var h = Object.assign({'Content-Type': 'application/json'}, extra);
  if (user && user.email) h['X-User-Email'] = user.email;
  return h;
}
function getFormHeaders() {
  var saved = localStorage.getItem('tg_demo_user');
  var user  = saved ? JSON.parse(saved) : null;
  var h = {};
  if (user && user.email) h['X-User-Email'] = user.email;
  return h;
}

function handleAuthNav() {
  const user = localStorage.getItem('tg_demo_user');
  if (user) {
    showPage('settings', document.querySelector('.nav-link:last-child'));
  } else {
    openAuth();
  }
}

async function logoutUser() {
  try { await fetch(`${API}/api/auth/logout`, {method:'POST',}); } catch {}
  localStorage.removeItem('tg_demo_user');
  document.getElementById('userPill').style.display = 'none';
  document.getElementById('authNavLabel').textContent = t('login');
  toast('info', 'Logged out');
}

/* ─── OPTIONS ───────────────────────────────────── */
async function loadOptions() {
  const defaults = {
    day_of_week:   ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    road_type:     ['Highway','Urban Road','Residential','State Highway','National Highway'],
    weather:       ['Clear','Rainy','Foggy','Cloudy','Heavy Rain'],
    vehicle_type:  ['Car','Motorcycle','Truck','Bus','Auto','Bicycle'],
    road_condition:['Dry','Wet','Slippery','Under Construction','Good'],
    junction_type: ['No Junction','T-Junction','Roundabout','Intersection','Y-Junction'],
  };
  let opts = defaults;
  try {
    const r = await fetch(`${API}/api/options`);
    opts = await r.json();
  } catch {}

  Object.entries(opts).forEach(([id, values]) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    values.forEach(v => {
      const o = document.createElement('option');
      o.value = o.textContent = v;
      sel.appendChild(o);
    });
  });
  // Defaults
  setOpt('day_of_week','Monday'); setOpt('road_type','Highway');
  setOpt('weather','Rainy'); setOpt('vehicle_type','Car');
  setOpt('road_condition','Wet'); setOpt('junction_type','Intersection');
}

function setOpt(id, val) {
  const s = document.getElementById(id);
  if (!s) return;
  [...s.options].forEach((o,i) => { if (o.value===val) s.selectedIndex=i; });
}

/* ─── HOUR ──────────────────────────────────────── */
function onHourChange(val) {
  const h = parseInt(val);
  document.getElementById('hourDisplay').textContent = `${String(h).padStart(2,'0')}:00`;
  const isPeak = (h>=7&&h<=10)||(h>=17&&h<=20);
  document.getElementById('peakTag').classList.toggle('show', isPeak);
}

/* ─── TOGGLE ────────────────────────────────────── */
function toggle(switchId, labelId) {
  const sw  = document.getElementById(switchId);
  const lbl = document.getElementById(labelId);
  sw.classList.toggle('on');
  if (lbl) lbl.textContent = sw.classList.contains('on') ? 'Yes' : 'No';
}

/* ─── PREDICT ───────────────────────────────────── */
async function predict() {
  const btn = document.getElementById('predictBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span>⏳</span> <span>Analyzing…</span>';

  const hour = parseInt(document.getElementById('hour').value);
  const isPeak = ((hour>=7&&hour<=10)||(hour>=17&&hour<=20)) ? 1 : 0;

  const now = new Date();
  const payload = {
    hour, is_peak_hour: isPeak,
    month:              now.getMonth() + 1,
    is_weekend:         [0,6].includes(now.getDay()) ? 1 : 0,
    day_of_week:        document.getElementById('day_of_week').value,
    road_type:          document.getElementById('road_type').value,
    weather:            document.getElementById('weather').value,
    vehicle_type:       document.getElementById('vehicle_type').value,
    road_condition:     document.getElementById('road_condition').value,
    junction_type:      document.getElementById('junction_type').value,
    traffic_density:    parseInt(document.getElementById('traffic_density').value),
    speed:              parseInt(document.getElementById('speed').value),
    visibility:         parseInt(document.getElementById('visibility').value),
    vehicles_involved:  parseInt(document.getElementById('vehicles_involved').value),
    temperature:        parseInt(document.getElementById('temperature').value),
    humidity:           parseInt(document.getElementById('humidity').value),
    alcohol_involved:   document.getElementById('alcSwitch').classList.contains('on') ? 1 : 0,
    driver_distracted:  document.getElementById('distSwitch').classList.contains('on') ? 1 : 0,
    pedestrians_involved: parseInt(document.getElementById('pedestrians_involved').value),
    vehicle_age:        parseInt(document.getElementById('vehicle_age').value),
    // derived fields
    speed_limit:        ['Highway','National Highway'].includes(document.getElementById('road_type').value) ? 80 :
                        document.getElementById('road_type').value === 'State Highway' ? 60 : 40,
    road_width:         8,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const r = await fetch(`${API}/api/predict`, {
      method:'POST', headers:getHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    lastResult = { ...data, input: payload, timestamp: new Date().toISOString() };
    showResult(lastResult);
    saveLocalHistory(lastResult);
  } catch (e) {
    if (e.name === 'AbortError') {
      showResultError('Request timed out. Make sure Flask server is running: python app.py');
    } else {
      showResultError(e.message || 'Cannot connect to API. Run: python app.py in terminal');
    }
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span>⚡</span> <span data-i18n="run_prediction">Run Prediction</span>';
  }
}

/* ─── SHOW RESULT ───────────────────────────────── */
function showResult(data) {
  const sev = (data.severity || '').toLowerCase();
  document.getElementById('resultIdle').style.display   = 'none';
  document.getElementById('resultOutput').style.display = 'block';

  // Severity badge
  const badge = document.getElementById('sevBadge');
  badge.className = `sev-badge ${sev}`;
  const emojis = { low:'✅', medium:'⚠️', high:'🚨' };
  document.getElementById('sevEmoji').textContent  = emojis[sev] || '🔴';
  document.getElementById('sevValue').textContent  = (data.severity||'').toUpperCase();

  // Advice
  const adv = document.getElementById('adviceCard');
  adv.textContent = data.advice || '';
  adv.className   = `advice-card ${sev}`;

  // Probabilities
  const pb = document.getElementById('probBars');
  pb.innerHTML = '';
  const colorMap = { Low:'low', Medium:'medium', High:'high' };
  Object.entries(data.probability || {})
    .sort((a,b) => b[1]-a[1])
    .forEach(([cls, pct]) => {
      const div = document.createElement('div');
      div.className = 'prob-row';
      div.innerHTML = `
        <span class="prob-lbl">${cls.toUpperCase()}</span>
        <div class="prob-track"><div class="prob-fill ${colorMap[cls]||''}" data-w="${pct}" style="width:0"></div></div>
        <span class="prob-pct">${pct}%</span>`;
      pb.appendChild(div);
    });
  requestAnimationFrame(() => {
    document.querySelectorAll('.prob-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
  });

  // Model consensus
  const indiv = data.individual_models || {};
  if (Object.keys(indiv).length > 0) {
    const block = document.getElementById('consensusBlock');
    block.style.display = 'block';
    const rows = document.getElementById('consensusRows');
    const nameMap = { rf:'Random Forest', xgb:'XGBoost', lr:'Logistic Reg.', svm:'SVM', dt:'Decision Tree', knn:'KNN', nb:'Naive Bayes' };
    rows.innerHTML = Object.entries(indiv).map(([k,v]) => `
      <div class="consensus-row">
        <span class="consensus-name">${nameMap[k]||k}</span>
        <span class="consensus-sev ${v.toLowerCase()}">${v.toUpperCase()}</span>
      </div>`).join('');
  }

  // Model tag
  document.getElementById('modelTag').textContent = `Model: ${data.model_used || 'Unknown'} · ${new Date().toLocaleTimeString()}`;

  // Alert flash for high
  if (sev === 'high') toast('warning', '🚨 HIGH SEVERITY detected!');
}

function showResultError(msg) {
  document.getElementById('resultIdle').style.display   = 'none';
  document.getElementById('resultOutput').style.display = 'block';
  const badge = document.getElementById('sevBadge');
  badge.className = 'sev-badge high';
  document.getElementById('sevEmoji').textContent = '❌';
  document.getElementById('sevValue').textContent = 'ERROR';
  const adv = document.getElementById('adviceCard');
  adv.textContent = '⚠ ' + msg;
  adv.className = 'advice-card high';
  document.getElementById('probBars').innerHTML = '';
  toast('error', msg);
}

/* ─── RESET FORM ────────────────────────────────── */
function resetForm() {
  document.getElementById('hour').value = 8; onHourChange(8);
  document.getElementById('traffic_density').value = 5;
  document.getElementById('tdVal').textContent = '5';
  document.getElementById('speed').value = 50;
  document.getElementById('spVal').textContent = '50';
  document.getElementById('visibility').value = 7;
  document.getElementById('visVal').textContent = '7';
  document.getElementById('vehicles_involved').value = 2;
  document.getElementById('viVal').textContent = '2';
  document.getElementById('temperature').value = 28;
  if (document.getElementById('tempVal')) document.getElementById('tempVal').textContent = '28';
  document.getElementById('humidity').value = 65;
  if (document.getElementById('humVal')) document.getElementById('humVal').textContent = '65';
  document.getElementById('pedestrians_involved').value = 0;
  if (document.getElementById('pedVal')) document.getElementById('pedVal').textContent = '0';
  document.getElementById('vehicle_age').value = 5;
  if (document.getElementById('ageVal')) document.getElementById('ageVal').textContent = '5';
  var alc = document.getElementById('alcSwitch');
  if (alc && alc.classList.contains('on')) { alc.classList.remove('on'); document.getElementById('alcVal').textContent = 'No'; }
  var dist = document.getElementById('distSwitch');
  if (dist && dist.classList.contains('on')) { dist.classList.remove('on'); document.getElementById('distVal').textContent = 'No'; }
  setOpt('day_of_week','Monday'); setOpt('road_type','Highway');
  setOpt('weather','Rainy'); setOpt('vehicle_type','Car');
  setOpt('road_condition','Wet'); setOpt('junction_type','Intersection');
  document.getElementById('resultIdle').style.display   = 'block';
  document.getElementById('resultOutput').style.display = 'none';
}

/* ─── LOCAL HISTORY ─────────────────────────────── */
function saveLocalHistory(result) {
  const history = JSON.parse(localStorage.getItem('tg_history') || '[]');
  history.unshift({ ...result, id: Date.now() });
  if (history.length > 100) history.pop();
  localStorage.setItem('tg_history', JSON.stringify(history));
}

function loadHistory() {
  let preds = [];
  // Try API first
  const user = localStorage.getItem('tg_demo_user');
  try {
    fetch(`${API}/api/history`, {headers: getHeaders()})
      .then(r => r.json())
      .then(d => { if (d.predictions) renderHistory(d.predictions); })
      .catch(() => {});
  } catch {}
  // Always render local too
  const local = JSON.parse(localStorage.getItem('tg_history') || '[]');
  renderHistory(local);
}

function renderHistory(preds) {
  historyData = preds;
  const tbody = document.getElementById('historyTableBody');

  // Stats
  document.getElementById('histTotal').textContent = preds.length;
  document.getElementById('histHigh').textContent  = preds.filter(p => p.severity==='High').length;
  document.getElementById('histLow').textContent   = preds.filter(p => p.severity==='Low').length;

  if (!preds.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="emo">📭</span><span>${t('no_history')}</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = preds.slice(0,50).map((p,i) => {
    const sev   = (p.severity||'').toLowerCase();
    const inp   = p.input || {};
    const ts    = p.timestamp ? new Date(p.timestamp).toLocaleString() : '—';
    return `<tr>
      <td class="mono text-xs">${i+1}</td>
      <td class="ts-cell">${ts}</td>
      <td><span class="sev-chip ${sev}">${(p.severity||'—').toUpperCase()}</span></td>
      <td>${inp.weather||'—'}</td>
      <td>${inp.road_type||'—'}</td>
      <td class="mono">${inp.hour!==undefined ? String(inp.hour).padStart(2,'0')+':00' : '—'}</td>
      <td class="mono">${inp.speed||'—'}</td>
      <td class="text-sm text2">${(p.model_used||'—').replace(' (GradientBoosting)','')}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteHistory(${p.id||i})">🗑</button></td>
    </tr>`;
  }).join('');

  // Trend chart
  renderHistoryTrend(preds);
}

function renderHistoryTrend(preds) {
  const last20 = preds.slice(0, 20).reverse();
  const sevMap  = { Low:1, Medium:2, High:3 };
  const data    = last20.map(p => sevMap[p.severity] || 0);
  const colors  = last20.map(p => {
    if (p.severity==='Low')    return 'rgba(52,211,153,0.8)';
    if (p.severity==='Medium') return 'rgba(255,179,71,0.8)';
    return 'rgba(255,107,107,0.8)';
  });

  mkChart('chartHistoryTrend', 'bar', {
    labels: last20.map((_,i) => `#${i+1}`),
    datasets: [{
      label: 'Severity', data,
      backgroundColor: colors, borderRadius: 4,
    }]
  }, {
    ...chartOpts(),
    scales: {
      x: chartAxis(), y: { ...chartAxis(), min:0, max:3.5,
        ticks: { color:'#9090c0', font:{family:'JetBrains Mono',size:10},
                 callback: v => ['','LOW','MED','HIGH'][v]||'' }
      }
    },
    plugins: { ...chartOpts().plugins, legend:{display:false} }
  });
}

function deleteHistory(id) {
  const history = JSON.parse(localStorage.getItem('tg_history') || '[]');
  const newH    = history.filter(p => p.id !== id);
  localStorage.setItem('tg_history', JSON.stringify(newH));
  renderHistory(newH);
  toast('info', 'Prediction removed');
}

function clearHistory() {
  if (!confirm('Clear all prediction history?')) return;
  localStorage.removeItem('tg_history');
  renderHistory([]);
  toast('info', 'History cleared');
}

/* ─── EXPORT ────────────────────────────────────── */
async function exportHistoryCSV() {
  const history = JSON.parse(localStorage.getItem('tg_history') || '[]');
  if (!history.length) { toast('warning', 'No history to export'); return; }

  const rows = [
    ['ID','Timestamp','Severity','Weather','Road Type','Hour','Speed','Traffic Density','Alcohol','Model'],
    ...history.map(p => {
      const inp = p.input||{};
      return [p.id, p.timestamp, p.severity, inp.weather, inp.road_type, inp.hour,
              inp.speed, inp.traffic_density, inp.alcohol_involved, p.model_used];
    })
  ];
  const csv  = rows.map(r => r.join(',')).join('\n');
  downloadFile(csv, 'predictions.csv', 'text/csv');
  toast('success', 'CSV exported!');
}

async function exportHistoryExcel() {
  const history = JSON.parse(localStorage.getItem('tg_history') || '[]');
  if (!history.length) { toast('warning', 'No history to export'); return; }
  if (typeof XLSX === 'undefined') { toast('error','XLSX library not loaded'); return; }

  const data = history.map(p => ({
    ID: p.id, Timestamp: p.timestamp, Severity: p.severity,
    Weather: p.input?.weather, Road_Type: p.input?.road_type,
    Hour: p.input?.hour, Speed: p.input?.speed,
    Traffic_Density: p.input?.traffic_density,
    Alcohol: p.input?.alcohol_involved, Model: p.model_used,
    Prob_Low: p.probability?.Low, Prob_Medium: p.probability?.Medium, Prob_High: p.probability?.High,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Predictions');
  XLSX.writeFile(wb, 'predictions.xlsx');
  toast('success', 'Excel exported!');
}

async function exportHistoryJSON() {
  const history = JSON.parse(localStorage.getItem('tg_history') || '[]');
  if (!history.length) { toast('warning', 'No history to export'); return; }
  downloadFile(JSON.stringify(history, null, 2), 'predictions.json', 'application/json');
  toast('success', 'JSON exported!');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], {type});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

async function exportPDF() {
  if (!lastResult) { toast('warning', 'Run a prediction first'); return; }
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    toast('error', 'jsPDF library not loaded'); return;
  }
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const sev  = lastResult.severity || '—';
  const inp  = lastResult.input || {};

  doc.setFontSize(22); doc.setTextColor(124,111,247);
  doc.text('TrafficGuard AI — Prediction Report', 20, 24);

  doc.setFontSize(12); doc.setTextColor(0,0,0);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 36);
  doc.text(`Model: ${lastResult.model_used || 'Unknown'}`, 20, 44);

  doc.setFontSize(16); doc.setTextColor(
    sev==='High'?220:sev==='Medium'?200:50,
    sev==='High'?50 :sev==='Medium'?150:180,
    sev==='High'?50 :sev==='Medium'?50 :100);
  doc.text(`Severity: ${sev.toUpperCase()}`, 20, 58);

  doc.setFontSize(11); doc.setTextColor(80,80,80);
  doc.text('Input Conditions:', 20, 72);
  const fields = [
    ['Hour', `${inp.hour}:00`], ['Weather', inp.weather], ['Road Type', inp.road_type],
    ['Road Condition', inp.road_condition], ['Speed', `${inp.speed} km/h`],
    ['Traffic Density', inp.traffic_density], ['Visibility', inp.visibility],
    ['Vehicles', inp.vehicles_involved], ['Alcohol', inp.alcohol_involved?'Yes':'No'],
    ['Junction', inp.junction_type],
  ];
  fields.forEach(([k,v],i) => {
    doc.setTextColor(100,100,100); doc.text(`${k}:`, 24, 82 + i*8);
    doc.setTextColor(30,30,30); doc.text(String(v||'—'), 80, 82 + i*8);
  });

  doc.setFontSize(13); doc.setTextColor(50,50,50);
  doc.text('Probability:', 20, 170);
  Object.entries(lastResult.probability||{}).forEach(([k,v],i) => {
    doc.text(`  ${k}: ${v}%`, 20, 180+i*8);
  });

  doc.setFontSize(10); doc.setTextColor(150,150,150);
  doc.text(lastResult.advice||'', 20, 210, {maxWidth: 170});

  doc.save(`trafficguard_${Date.now()}.pdf`);
  toast('success', 'PDF downloaded!');
}

function exportSingleExcel() {
  if (!lastResult) { toast('warning', 'Run a prediction first'); return; }
  if (typeof XLSX === 'undefined') { toast('error','XLSX not loaded'); return; }
  const inp = lastResult.input || {};
  const row = [{
    Timestamp: lastResult.timestamp, Severity: lastResult.severity,
    Model: lastResult.model_used, ...inp,
    Prob_Low: lastResult.probability?.Low,
    Prob_Medium: lastResult.probability?.Medium,
    Prob_High: lastResult.probability?.High,
  }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(row), 'Prediction');
  XLSX.writeFile(wb, `prediction_${Date.now()}.xlsx`);
  toast('success', 'Excel exported!');
}

function printReport() {
  window.print();
}

/* ─── DASHBOARD ─────────────────────────────────── */
let dashLoaded = false;
async function loadDashboard() {
  if (dashLoaded) return;
  let data = {};
  try {
    const r = await fetch(`${API}/api/dataset-stats`);
    data = await r.json();
  } catch {
    data = getMockStats();
  }
  dashLoaded = true;

  // Stats
  document.getElementById('statRecords').textContent = (data.total_records||5000).toLocaleString();
  document.getElementById('statPeak').textContent    = (data.peak_hour_accidents||2100).toLocaleString();
  const sev = data.severity_distribution || {};
  document.getElementById('statHigh').textContent   = (sev.High||1200).toLocaleString();
  document.getElementById('statSpeed').textContent  = (data.avg_speed||48.3).toString();

  // Charts
  renderDashCharts(data);
}

function renderDashCharts(data) {
  const sev   = data.severity_distribution || {Low:2000, Medium:2000, High:1000};
  const hourly= data.hourly_distribution   || {};
  const weather=data.weather_distribution  || {};
  const road  = data.road_type_distribution|| {};
  const days  = data.day_distribution      || {};
  const alc   = data.alcohol_severity      || {};
  const fi    = data.feature_importance || {};

  // Severity donut
  mkChart('chartSeverity', 'doughnut', {
    labels: Object.keys(sev),
    datasets: [{ data: Object.values(sev), backgroundColor:['#34d399','#ffb347','#ff6b6b'],
                 borderColor:'var(--bg)', borderWidth:3 }]
  }, { ...chartOpts(), cutout:'68%', scales:{},
       plugins:{ ...chartOpts().plugins, legend:{position:'bottom',labels:{color:'#9090c0',font:{family:'JetBrains Mono',size:11},padding:12}} }
  });

  // Hourly bar
  const hrs    = Array.from({length:24},(_,i)=>i);
  const hData  = hrs.map(h => hourly[h]||hourly[String(h)]||0);
  const hColors= hrs.map(h => ((h>=7&&h<=10)||(h>=17&&h<=20)) ? '#ff6b6b' : '#7c6ff7');
  mkChart('chartHourly', 'bar', {
    labels: hrs.map(h=>`${h}h`),
    datasets: [{ data:hData, backgroundColor:hColors, borderRadius:2 }]
  }, { ...chartOpts(), plugins:{...chartOpts().plugins,legend:{display:false}} });

  // Weather horizontal bar
  mkChart('chartWeather', 'bar', {
    labels: Object.keys(weather),
    datasets: [{
      data: Object.values(weather), borderRadius:4,
      backgroundColor:['#34d399','#00d4b8','#ffb347','#ff6b6b','#7c6ff7'],
    }]
  }, { ...chartOpts(), indexAxis:'y', plugins:{...chartOpts().plugins,legend:{display:false}} });

  // Road type doughnut
  mkChart('chartRoad', 'doughnut', {
    labels: Object.keys(road),
    datasets: [{ data: Object.values(road),
                 backgroundColor:['#7c6ff7','#00d4b8','#ffb347','#ff6b6b','#38bdf8'],
                 borderColor:'var(--bg)', borderWidth:3 }]
  }, { ...chartOpts(), cutout:'58%', scales:{},
       plugins:{...chartOpts().plugins,legend:{position:'bottom',labels:{color:'#9090c0',font:{family:'JetBrains Mono',size:11},padding:10}}}
  });

  // Day of week
  const dayOrder=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  mkChart('chartDay', 'bar', {
    labels: dayOrder.map(d=>d.slice(0,3)),
    datasets: [{
      data: dayOrder.map(d => days[d]||0), borderRadius:4,
      backgroundColor: dayOrder.map(d=>
        (d==='Saturday'||d==='Sunday') ? '#ff6b6b' : '#7c6ff7')
    }]
  }, { ...chartOpts(), plugins:{...chartOpts().plugins,legend:{display:false}} });

  // Alcohol stacked
  const alcKeys = Object.keys(alc);
  const sevCls  = ['Low','Medium','High'];
  const alcDatasets = sevCls.map((s,i) => ({
    label:s, borderRadius:4,
    backgroundColor:['#34d399','#ffb347','#ff6b6b'][i],
    data: alcKeys.map(k => (alc[k]&&alc[k][s]) || 0),
  }));
  mkChart('chartAlcohol', 'bar', {
    labels: alcKeys.map(k => k==='0'?'No Alcohol':'Alcohol'),
    datasets: alcDatasets,
  }, { ...chartOpts(), scales:{ x:{...chartAxis(),stacked:true}, y:{...chartAxis(),stacked:true} },
       plugins:{...chartOpts().plugins, legend:{labels:{color:'#9090c0',font:{family:'JetBrains Mono',size:10}}}}
  });

  // Feature importance
  if (fi && Object.keys(fi).length) {
    const sorted = Object.entries(fi).sort((a,b)=>b[1]-a[1]).slice(0,12);
    mkChart('chartFI', 'bar', {
      labels: sorted.map(([k])=>k),
      datasets:[{
        data: sorted.map(([,v])=>Math.round(v*1000)/10),
        backgroundColor: sorted.map((_,i)=>`hsla(${260-i*12},80%,65%,0.85)`),
        borderRadius:4
      }]
    }, { ...chartOpts(), plugins:{...chartOpts().plugins,legend:{display:false}} });
    document.getElementById('fiCard').style.display='block';
  }
}

/* ─── MAP ───────────────────────────────────────── */
let mapRendered = false;
async function renderMap() {
  if (mapRendered) return;
  mapRendered = true;

  let hotspots = [];
  try {
    const r = await fetch(`${API}/api/dataset-stats`);
    const d = await r.json();
    hotspots = d.hotspots || [];
  } catch {
    hotspots = getDefaultHotspots();
  }

  // Map bounds (Bangalore approx)
  const minLat=12.87, maxLat=13.07, minLng=77.49, maxLng=77.77;
  const mapEl = document.getElementById('hotspotMap');
  const W     = mapEl.offsetWidth  || 800;
  const H     = 500;

  const dotsEl = document.getElementById('hotspotDots');
  dotsEl.innerHTML = '';

  hotspots.forEach(hs => {
    const xPct = (hs.lng - minLng) / (maxLng - minLng) * 100;
    const yPct = (1 - (hs.lat - minLat) / (maxLat - minLat)) * 100;

    const div  = document.createElement('div');
    div.className = `hotspot-dot ${(hs.severity||'medium').toLowerCase()}`;
    div.style.left = xPct + '%';
    div.style.top  = yPct + '%';
    div.innerHTML  = `
      <div class="hotspot-circle">${hs.count||''}</div>
      <div class="hotspot-label">${hs.name}</div>`;
    div.title = `${hs.name}: ${hs.count} incidents (${hs.severity})`;
    dotsEl.appendChild(div);
  });

  // Table
  const tbody = document.getElementById('hotspotTableBody');
  tbody.innerHTML = hotspots.map(hs => `
    <tr>
      <td><strong>${hs.name}</strong></td>
      <td class="mono">${hs.count}</td>
      <td><span class="sev-chip ${(hs.severity||'').toLowerCase()}">${(hs.severity||'').toUpperCase()}</span></td>
      <td class="mono text-xs">${hs.lat}, ${hs.lng}</td>
    </tr>`).join('');
}

/* ─── MODELS ────────────────────────────────────── */
let modelsLoaded = false;
async function loadModels() {
  if (modelsLoaded) return;
  modelsLoaded = true;

  let data = {};
  try {
    const r = await fetch(`${API}/api/model-metrics`);
    data = await r.json();
  } catch {
    data = getMockMetrics();
  }

  const best    = data.best_model || '';
  const metrics = data.metrics    || {};

  // Accuracy bars
  const barsEl = document.getElementById('accuracyBars');
  barsEl.innerHTML = '';
  Object.entries(metrics).forEach(([name, m]) => {
    const isBest = name === best;
    const div = document.createElement('div');
    div.className = 'metrics-bar-row mt8';
    div.innerHTML = `
      <span class="metrics-model-name">${name.replace(' (GradientBoosting)','')}
        ${isBest?'<span class="best-flag">★ BEST</span>':''}</span>
      <div class="metrics-bar-track"><div class="metrics-bar-fill" data-w="${m.accuracy||0}"></div></div>
      <span class="metrics-pct">${m.accuracy||0}%</span>`;
    barsEl.appendChild(div);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.metrics-bar-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  });

  // Full metrics table
  const tbody = document.getElementById('metricsTableBody');
  tbody.innerHTML = Object.entries(metrics).map(([name,m]) => `
    <tr ${name===best?'style="background:rgba(124,111,247,0.05)"':''}>
      <td><strong>${name.replace(' (GradientBoosting)','')}</strong>
          ${name===best?'<span class="best-flag">★ BEST</span>':''}</td>
      <td class="mono">${m.accuracy||'—'}%</td>
      <td class="mono">${m.precision||'—'}%</td>
      <td class="mono">${m.recall||'—'}%</td>
      <td class="mono">${m.f1_score||'—'}%</td>
      <td class="mono">${m.cv_mean||'—'}%</td>
      <td class="mono">±${m.cv_std||'—'}%</td>
      <td>${name===best?'<span class="sev-chip low">BEST</span>':'<span style="color:var(--text3);font-size:11px">—</span>'}</td>
    </tr>`).join('');

  // CV scores
  const cvEl = document.getElementById('cvScores');
  const cv   = data.cross_val_scores || {};
  cvEl.innerHTML = Object.entries(cv).map(([name,scores]) => `
    <div class="cv-row">
      <span class="cv-name">${name.replace(' (GradientBoosting)','')}</span>
      <span class="cv-score">${scores.mean||'—'}% <span style="color:var(--text3)">± ${scores.std||'—'}%</span></span>
    </div>`).join('') || '<p class="text2 text-sm">No CV data available</p>';

  // Confusion matrix
  const bestMetrics = metrics[best] || {};
  const cm          = bestMetrics.confusion_matrix || data.confusion_matrix || [];
  const classes     = data.classes || ['Low','Medium','High'];
  if (cm.length) {
    const cmEl = document.getElementById('confusionMatrix');
    const total = cm.flat().reduce((a,b)=>a+b,0);
    let html = `<div class="confusion-grid" style="grid-template-columns:repeat(${classes.length+1},1fr)">`;
    html += '<div class="cm-cell cm-header"></div>';
    classes.forEach(c => { html += `<div class="cm-cell cm-header">${c.slice(0,3)}</div>`; });
    cm.forEach((row, ri) => {
      html += `<div class="cm-cell cm-header">${classes[ri]?.slice(0,3)||ri}</div>`;
      row.forEach((val, ci) => {
        const cls = ri===ci ? 'cm-diag' : 'cm-off';
        html += `<div class="cm-cell ${cls}" title="${val}/${total}">${val}</div>`;
      });
    });
    html += '</div>';
    cmEl.innerHTML = html;
  }

  // Radar chart
  const modelNames = Object.keys(metrics).slice(0, 5);
  if (modelNames.length) {
    mkChart('chartRadar', 'radar', {
      labels: ['Accuracy','Precision','Recall','F1-Score','CV Score'],
      datasets: modelNames.map((name, i) => {
        const m = metrics[name];
        return {
          label: name.replace(' (GradientBoosting)','').replace('K-Nearest Neighbors','KNN'),
          data: [m.accuracy||0, m.precision||0, m.recall||0, m.f1_score||0, m.cv_mean||0],
          borderColor: `hsl(${i*60},80%,65%)`,
          backgroundColor: `hsla(${i*60},80%,65%,0.08)`,
          pointBackgroundColor: `hsl(${i*60},80%,65%)`,
          borderWidth: 2,
        };
      })
    }, {
      ...chartOpts(), scales: {
        r: {
          angleLines:{color:'rgba(255,255,255,0.06)'},
          grid:{color:'rgba(255,255,255,0.06)'},
          pointLabels:{color:'#9090c0',font:{family:'JetBrains Mono',size:11}},
          ticks:{color:'#5050a0',backdropColor:'transparent',font:{size:9},stepSize:20},
          min:0, max:100,
        }
      },
      plugins:{
        ...chartOpts().plugins,
        legend:{labels:{color:'#9090c0',font:{family:'JetBrains Mono',size:10},padding:12}}
      }
    });
  }

  // Feature importance
  const fi = data.feature_importance || {};
  if (Object.keys(fi).length) {
    // Also show in dashboard if not shown yet
    if (!dashLoaded) return;
    // Could re-render here
  }
}

/* ─── UPLOAD ────────────────────────────────────── */
function onDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function onDragLeave() { document.getElementById('dropZone').classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileUpload(file);
}

async function handleFileUpload(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv')) { toast('error', 'Please upload a CSV file'); return; }
  toast('info', `Uploading ${file.name}…`);

  const fd = new FormData();
  fd.append('file', file);

  try {
    const r = await fetch(`${API}/api/upload`, { method:'POST', body:fd });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    showUploadResults(d);
    toast('success', `Analyzed ${d.rows} rows!`);
  } catch {
    // Parse locally
    parseLocalCSV(file);
  }
}

function parseLocalCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    const headers = lines[0].split(',').map(h=>h.trim());
    const rows    = lines.slice(1,6).map(l => {
      const vals = l.split(',');
      const row  = {};
      headers.forEach((h,i) => { row[h] = vals[i]?.trim()||''; });
      return row;
    });
    const d = {
      rows:   lines.length-1,
      columns: headers,
      sample:  rows,
    };
    showUploadResults(d);
    toast('success', `Parsed ${d.rows} rows locally`);
  };
  reader.readAsText(file);
}

function showUploadResults(data) {
  const el = document.getElementById('uploadResults');
  el.classList.add('show');

  document.getElementById('uploadStats').innerHTML = `
    <div class="stat-card"><span class="stat-icon">📊</span>
      <div class="stat-val">${(data.rows||0).toLocaleString()}</div>
      <div class="stat-lbl">Total Rows</div></div>
    <div class="stat-card teal"><span class="stat-icon">📋</span>
      <div class="stat-val">${(data.columns||[]).length}</div>
      <div class="stat-lbl">Columns</div></div>
    <div class="stat-card amber"><span class="stat-icon">🎯</span>
      <div class="stat-val">${data.predicted_severity ? 'Done' : 'N/A'}</div>
      <div class="stat-lbl">Batch Predict</div></div>`;

  if (data.predicted_severity && Object.keys(data.predicted_severity).length) {
    const ps = data.predicted_severity;
    mkChart('chartUpload', 'doughnut', {
      labels: Object.keys(ps),
      datasets:[{ data:Object.values(ps),
                  backgroundColor:['#34d399','#ffb347','#ff6b6b'],
                  borderColor:'var(--bg)', borderWidth:3 }]
    }, { ...chartOpts(), cutout:'60%', scales:{},
         plugins:{...chartOpts().plugins,legend:{position:'bottom',labels:{color:'#9090c0'}}} });
  } else if (data.severity_distribution) {
    const sd = data.severity_distribution;
    mkChart('chartUpload', 'bar', {
      labels: Object.keys(sd),
      datasets:[{ data:Object.values(sd), backgroundColor:['#34d399','#ffb347','#ff6b6b'], borderRadius:4 }]
    }, { ...chartOpts(), plugins:{...chartOpts().plugins,legend:{display:false}} });
  }

  const sample = data.sample || [];
  if (sample.length) {
    const cols = Object.keys(sample[0]);
    let html = '<table><thead><tr>' + cols.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>';
    sample.forEach(row => {
      html += '<tr>' + cols.map(c=>`<td>${row[c]||''}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('sampleTable').innerHTML = html;
  }
}

/* ─── SETTINGS ──────────────────────────────────── */
function loadSettings() {
  const user = JSON.parse(localStorage.getItem('tg_demo_user') || 'null');
  if (user) {
    document.getElementById('settingsName').value  = user.name  || '';
    document.getElementById('settingsEmail').value = user.email || '';
    document.getElementById('logoutBtn').style.display = 'inline-flex';
  }
  setLanguage(currentLang);
}

async function saveProfile() {
  const name  = document.getElementById('settingsName').value.trim();
  const email = document.getElementById('settingsEmail').value.trim();

  const user = JSON.parse(localStorage.getItem('tg_demo_user') || '{}');
  const updated = { ...user, name, alert_email: email };
  localStorage.setItem('tg_demo_user', JSON.stringify(updated));
  setCurrentUser(updated);

  try {
    await fetch(`${API}/api/auth/settings`, {
      method:'PUT', headers:getHeaders(),
      body: JSON.stringify({ name, alert_email: email }),
    });
  } catch {}

  toast('success', 'Settings saved!');
}

/* ─── CHART HELPERS ─────────────────────────────── */
const chartOpts = () => ({
  responsive: true, maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#16162a',
      borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
      titleColor: '#7c6ff7', bodyColor: '#f0f0ff', padding: 12,
      titleFont: { family:'JetBrains Mono', size:11 },
      bodyFont:  { family:'JetBrains Mono', size:11 },
    }
  },
  scales: { x: chartAxis(), y: chartAxis() },
  animation: { duration: 600 },
});
const chartAxis = () => ({
  ticks: { color:'#9090c0', font:{ family:'JetBrains Mono', size:10 } },
  grid:  { color:'rgba(255,255,255,0.04)' },
});

function mkChart(id, type, data, opts) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) { charts[id].destroy(); }
  charts[id] = new Chart(ctx, { type, data, options: opts });
  return charts[id];
}

/* ─── TOAST ─────────────────────────────────────── */
function toast(type, msg, duration=3500) {
  const container = document.getElementById('toastContainer');
  const el        = document.createElement('div');
  el.className    = `toast ${type}`;
  el.innerHTML    = `<span>${msg}</span>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, duration);
}

/* ─── MOCK DATA ─────────────────────────────────── */
function getMockStats() {
  return {
    total_records:5000, peak_hour_accidents:2100, avg_speed:48.3,
    severity_distribution:{Low:2100, Medium:1700, High:1200},
    hourly_distribution:{0:50,1:30,2:25,3:20,4:30,5:60,6:120,7:280,8:320,9:250,10:200,11:160,12:180,13:170,14:165,15:175,16:210,17:310,18:330,19:290,20:220,21:180,22:140,23:90},
    weather_distribution:{Clear:2200,Rainy:1300,Foggy:500,Cloudy:750,HeavyRain:250},
    road_type_distribution:{Highway:1000,UrbanRoad:1750,Residential:1000,StateHighway:750,NationalHighway:500},
    day_distribution:{Monday:740,Tuesday:710,Wednesday:720,Thursday:730,Friday:760,Saturday:680,Sunday:660},
    alcohol_severity:{'0':{Low:1900,Medium:1500,High:750},'1':{Low:200,Medium:200,High:450}},
    hotspots: getDefaultHotspots(),
    feature_importance:{ traffic_density:0.18, visibility:0.16, speed:0.14, alcohol_involved:0.12, vehicles_involved:0.1, road_condition:0.08, weather:0.07, junction_type:0.06, is_peak_hour:0.05, road_type:0.04 }
  };
}

function getMockMetrics() {
  return {
    best_model:'Random Forest',
    classes:['High','Low','Medium'],
    metrics:{
      'Random Forest':     {accuracy:85.4, precision:85.1, recall:85.4, f1_score:85.2, cv_mean:84.8, cv_std:1.2, confusion_matrix:[[180,20,30],[15,350,15],[25,18,247]]},
      'XGBoost':           {accuracy:84.2, precision:84.0, recall:84.2, f1_score:84.1, cv_mean:83.5, cv_std:1.4},
      'Logistic Regression':{accuracy:74.1, precision:73.8, recall:74.1, f1_score:73.9, cv_mean:73.5, cv_std:1.8},
      'SVM':               {accuracy:77.3, precision:77.0, recall:77.3, f1_score:77.1, cv_mean:76.8, cv_std:1.6},
      'Decision Tree':     {accuracy:79.5, precision:79.2, recall:79.5, f1_score:79.3, cv_mean:77.2, cv_std:2.1},
      'K-Nearest Neighbors':{accuracy:76.8, precision:76.5, recall:76.8, f1_score:76.6, cv_mean:75.9, cv_std:1.9},
      'Naive Bayes':       {accuracy:68.3, precision:67.9, recall:68.3, f1_score:68.0, cv_mean:67.8, cv_std:2.3},
    },
    cross_val_scores:{
      'Random Forest':     {mean:84.8, std:1.2},
      'XGBoost':           {mean:83.5, std:1.4},
      'Logistic Regression':{mean:73.5, std:1.8},
      'SVM':               {mean:76.8, std:1.6},
      'Decision Tree':     {mean:77.2, std:2.1},
      'K-Nearest Neighbors':{mean:75.9, std:1.9},
      'Naive Bayes':       {mean:67.8, std:2.3},
    },
    feature_importance:{traffic_density:0.18,visibility:0.16,speed:0.14,alcohol_involved:0.12,vehicles_involved:0.1,road_condition:0.08,weather:0.07,junction_type:0.06,is_peak_hour:0.05,road_type:0.04}
  };
}

function getDefaultHotspots() {
  return [
    {name:"Silk Board",lat:12.9177,lng:77.6220,count:312,severity:"High"},
    {name:"MG Road",lat:12.9758,lng:77.6077,count:245,severity:"High"},
    {name:"Electronic City",lat:12.8452,lng:77.6602,count:267,severity:"High"},
    {name:"Yeshwantpur",lat:13.0234,lng:77.5518,count:178,severity:"High"},
    {name:"Hebbal",lat:13.0358,lng:77.5970,count:198,severity:"Medium"},
    {name:"Marathahalli",lat:12.9591,lng:77.6988,count:189,severity:"Medium"},
    {name:"Whitefield",lat:12.9698,lng:77.7499,count:156,severity:"Medium"},
    {name:"Koramangala",lat:12.9352,lng:77.6245,count:134,severity:"Medium"},
    {name:"BTM Layout",lat:12.9165,lng:77.6101,count:112,severity:"Low"},
    {name:"Indiranagar",lat:12.9784,lng:77.6408,count:143,severity:"Low"},
  ];
}

/* ─── KEYBOARD SHORTCUTS ────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') predict();
  if (e.key === 'Escape') closeAuth();
});

// Enter key on auth forms
document.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('loginPwd') === document.activeElement) doLogin();
    if (document.getElementById('regPwd')   === document.activeElement) doRegister();
  }
});
