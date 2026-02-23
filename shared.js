
// ======= SHARED COLORS =======
const COLORS = [
  '#f0883e','#bc8cff','#3fb950','#ff7b72','#58a6ff',
  '#e3b341','#f778ba','#39d353','#ffa657','#79c0ff'
];

// ======= PROCESS TABLE MANAGEMENT =======
let processes = [];
let pidCounter = 1;

function initTable(defaultRows) {
  processes = [];
  pidCounter = 1;
  defaultRows.forEach(r => addProcess(r.arrival, r.service));
  renderTable();
}

function addProcess(arrival = 0, service = 1) {
  processes.push({
    id: pidCounter++,
    arrival: parseInt(arrival),
    service: parseInt(service),
    color: COLORS[(pidCounter - 2) % COLORS.length]
  });
  renderTable();
}

function removeProcess(id) {
  processes = processes.filter(p => p.id !== id);
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('proc-tbody');
  tbody.innerHTML = '';
  processes.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="proc-label" style="background:${p.color}20;color:${p.color};border:1px solid ${p.color}40">P${p.id}</span></td>
      <td><input type="number" class="num-input" min="0" value="${p.arrival}" onchange="processes.find(x=>x.id==${p.id}).arrival=parseInt(this.value)||0"/></td>
      <td><input type="number" class="num-input" min="1" value="${p.service}" onchange="processes.find(x=>x.id==${p.id}).service=Math.max(1,parseInt(this.value)||1)"/></td>
      <td><button class="del-btn" onclick="removeProcess(${p.id})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ======= GANTT RENDERING =======
function renderGantt(segments, totalTime, containerId, timelineId) {
  const cont = document.getElementById(containerId);
  const tl = document.getElementById(timelineId);
  cont.innerHTML = '';
  tl.innerHTML = '';

  segments.forEach(seg => {
    const w = ((seg.end - seg.start) / totalTime * 100).toFixed(3);
    const div = document.createElement('div');
    div.className = 'g-seg';
    div.style.width = w + '%';
    div.style.background = seg.color + '33';
    div.style.color = seg.color;
    div.style.borderRight = `2px solid ${seg.color}55`;
    div.title = `P${seg.pid}: ${seg.start}→${seg.end}`;
    div.innerHTML = `<span>P${seg.pid}</span>`;
    cont.appendChild(div);
  });

  // Build timeline ticks from unique times
  const times = [...new Set(segments.flatMap(s => [s.start, s.end]))].sort((a,b)=>a-b);
  times.forEach(t => {
    const span = document.createElement('div');
    span.className = 'g-tick';
    span.style.left = (t / totalTime * 100).toFixed(3) + '%';
    span.textContent = t;
    tl.appendChild(span);
  });
}

// ======= RESULT TABLE RENDERING =======
function renderResultTable(results, tableId, avgColor) {
  const tbody = document.getElementById(tableId);
  tbody.innerHTML = '';
  let sumTr = 0, sumNtr = 0;
  results.forEach(r => {
    const tr_val = r.finish - r.arrival;
    const ntr_val = (tr_val / r.service).toFixed(2);
    sumTr += tr_val;
    sumNtr += parseFloat(ntr_val);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="proc-label" style="background:${r.color}20;color:${r.color};border:1px solid ${r.color}40">P${r.id}</span></td>
      <td>${r.arrival}</td><td>${r.service}</td>
      <td>${r.start_first ?? '-'}</td>
      <td>${r.finish}</td>
      <td>${tr_val}</td>
      <td>${ntr_val}</td>
    `;
    tbody.appendChild(tr);
  });
  const avg = document.createElement('tr');
  avg.className = 'avg-row';
  const avgTr = (sumTr / results.length).toFixed(2);
  const avgNtr = (sumNtr / results.length).toFixed(2);
  avg.innerHTML = `<td colspan="5" style="color:var(--muted);font-size:0.72rem">AVERAGE</td>
    <td style="color:${avgColor};font-weight:700">${avgTr}</td>
    <td style="color:${avgColor};font-weight:700">${avgNtr}</td>`;
  tbody.appendChild(avg);

  // Update summary stats
  if(document.getElementById('stat-avg-tr')) document.getElementById('stat-avg-tr').textContent = avgTr;
  if(document.getElementById('stat-avg-ntr')) document.getElementById('stat-avg-ntr').textContent = avgNtr;
}

// ======= ALGORITHMS =======

function runFCFS() {
  const procs = [...processes].sort((a,b) => a.arrival - b.arrival);
  let t = 0;
  const segments = [];
  const results = [];
  procs.forEach(p => {
    if (t < p.arrival) t = p.arrival;
    const start = t;
    t += p.service;
    segments.push({ pid: p.id, start, end: t, color: p.color });
    results.push({ ...p, start_first: start, finish: t });
  });
  return { segments, results, totalTime: t };
}

function runRR(quantum) {
  const procs = processes.map(p => ({ ...p, remaining: p.service, finished: false }))
    .sort((a,b) => a.arrival - b.arrival);
  let t = 0, queue = [], done = [], segments = [];
  const resultMap = {};
  procs.forEach(p => resultMap[p.id] = { ...p, start_first: null, finish: 0 });

  let idx = 0;
  // seed queue
  while (idx < procs.length && procs[idx].arrival <= t) { queue.push(procs[idx++]); }

  let safety = 0;
  while (done.length < procs.length && safety++ < 100000) {
    if (!queue.length) {
      t = procs[idx] ? procs[idx].arrival : t + 1;
      while (idx < procs.length && procs[idx].arrival <= t) { queue.push(procs[idx++]); }
      continue;
    }
    const cur = queue.shift();
    if (resultMap[cur.id].start_first === null) resultMap[cur.id].start_first = t;
    const run = Math.min(quantum, cur.remaining);
    segments.push({ pid: cur.id, start: t, end: t + run, color: cur.color });
    t += run;
    cur.remaining -= run;

    // enqueue newly arrived
    while (idx < procs.length && procs[idx].arrival <= t) { queue.push(procs[idx++]); }

    if (cur.remaining > 0) queue.push(cur);
    else { resultMap[cur.id].finish = t; done.push(cur.id); }
  }
  return { segments, results: Object.values(resultMap), totalTime: t };
}

function runSRT() {
  const procs = processes.map(p => ({ ...p, remaining: p.service, finished: false, start_first: null, finish: 0 }));
  let t = 0, segments = [], last = null, segStart = 0;
  const totalService = procs.reduce((s,p) => s + p.service, 0);
  let done = 0;

  while (done < procs.length) {
    const available = procs.filter(p => !p.finished && p.arrival <= t);
    if (!available.length) { t++; continue; }
    const cur = available.sort((a,b) => a.remaining - b.remaining || a.arrival - b.arrival)[0];
    if (cur.start_first === null) cur.start_first = t;

    if (last !== cur.id) {
      if (last !== null) segments.push({ pid: last, start: segStart, end: t, color: procs.find(p=>p.id===last).color });
      last = cur.id; segStart = t;
    }
    cur.remaining--;
    t++;
    if (cur.remaining === 0) {
      cur.finished = true; cur.finish = t; done++;
      segments.push({ pid: cur.id, start: segStart, end: t, color: cur.color });
      last = null;
    }
  }
  if (last !== null) segments.push({ pid: last, start: segStart, end: t, color: procs.find(p=>p.id===last).color });
  // merge consecutive same-pid segments
  const merged = [];
  segments.forEach(s => {
    if (merged.length && merged[merged.length-1].pid === s.pid && merged[merged.length-1].end === s.start)
      merged[merged.length-1].end = s.end;
    else merged.push({...s});
  });
  return { segments: merged, results: procs, totalTime: t };
}

function runHRRN() {
  const procs = processes.map(p => ({ ...p, finished: false, start_first: null, finish: 0 }));
  let t = 0, done = 0, segments = [];

  while (done < procs.length) {
    const available = procs.filter(p => !p.finished && p.arrival <= t);
    if (!available.length) { t++; continue; }
    // calc response ratio
    available.forEach(p => { p.ratio = (t - p.arrival + p.service) / p.service; });
    const cur = available.sort((a,b) => b.ratio - a.ratio || a.arrival - b.arrival)[0];
    if (cur.start_first === null) cur.start_first = t;
    segments.push({ pid: cur.id, start: t, end: t + cur.service, color: cur.color });
    t += cur.service;
    cur.finish = t; cur.finished = true; done++;
  }
  return { segments, results: procs, totalTime: t };
}
