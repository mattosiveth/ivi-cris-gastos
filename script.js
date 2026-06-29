
// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — edita solo esta sección
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  // Paso 1: Publica tu Sheet como CSV y pega el link aquí
  // Archivo → Compartir → Publicar en la web → hoja "📋 Registro" → CSV
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_tYgI3pUr0m6hRGPTvdR1sjnK0aLxkxBJAM1esj0xyUm3_wLrNzbgLJGNOy6AxT_fm8jnlAlzxJeB/pub?gid=1962378565&single=true&output=csv',   // <- unico dato que falta

  META: 3000,
  IVI_CARD: '3012',
  CRIS_CARD: '3912',
  PERIODO_ACTUAL: 'Jun 11 - Jul 10',   // periodo activo — actualizar cada mes
  REFRESH_MS: 5 * 60 * 1000,
  DASHBOARD_URL: 'https://mattosiveth.github.io/ivi-cris-gastos',
};

// ═══════════════════════════════════════════════════════════
// PERÍODOS DE FACTURACIÓN 2026
// ═══════════════════════════════════════════════════════════
const PERIODOS = [
  {id:'Dic-Ene', label:'Dic 11 – Ene 10', mes:'Ene 2026'},
  {id:'Ene-Feb', label:'Ene 11 – Feb 10', mes:'Feb 2026'},
  {id:'Feb-Mar', label:'Feb 11 – Mar 10', mes:'Mar 2026'},
  {id:'Mar-Abr', label:'Mar 11 – Abr 10', mes:'Abr 2026'},
  {id:'Abr-May', label:'Abr 11 – May 10', mes:'May 2026'},
  {id:'May-Jun', label:'May 11 – Jun 10', mes:'Jun 2026'},
  {id:'Jun-Jul', label:'Jun 11 – Jul 10', mes:'Jul 2026'},
  {id:'Jul-Ago', label:'Jul 11 – Ago 10', mes:'Ago 2026'},
  {id:'Ago-Sep', label:'Ago 11 – Sep 10', mes:'Sep 2026'},
  {id:'Sep-Oct', label:'Sep 11 – Oct 10', mes:'Oct 2026'},
  {id:'Oct-Nov', label:'Oct 11 – Nov 10', mes:'Nov 2026'},
  {id:'Nov-Dic', label:'Nov 11 – Dic 10', mes:'Dic 2026'},
];

const CATS = ['Alimentación','Transporte','Entretenimiento','Salud','Servicios Básicos',
              'Educación','Ropa','Compras Online','Restaurantes','Viajes','Hogar','Otros'];

const FUCHSIA = '#d6336c', BLUE = '#2a78d6', RED = '#e34948', GREEN = '#1baf7a';

// ═══════════════════════════════════════════════════════════
// DATA LAYER — lee CSV de Google Sheets
// ═══════════════════════════════════════════════════════════
let ALL_TXNS = [];
let lastRefresh = null;
let chartMes = null, chartEvo = null;

async function fetchData() {
  try {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('app').style.opacity = '0.5';

    const res = await fetch(CONFIG.SHEET_CSV_URL + '&t=' + Date.now());
    const csv = await res.text();
    ALL_TXNS = parseCSV(csv);

    lastRefresh = new Date();
    document.getElementById('last-refresh').textContent =
      'Actualizado: ' + lastRefresh.toLocaleTimeString('es-PE');

    renderAll();
  } catch(e) {
    console.error('Error cargando datos:', e);
    document.getElementById('error-msg').style.display = 'block';
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.opacity = '1';
  }
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  // skip header row (row 0)
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    if (!cols[0]) return null;
    return {
      fechaHora:    cols[0]  || '',
      periodo:      cols[1]  || '',
      mesPago:      cols[2]  || '',
      anio:         cols[3]  || '',
      titular:      cols[4]  || '',
      tarjeta:      cols[5]  || '',
      empresa:      cols[6]  || '',
      categoria:    cols[7]  || 'Otros',
      subcategoria: cols[8]  || '',
      moneda:       cols[9]  || 'PEN',
      montoOrig:    parseFloat((cols[10]||'0').replace(/[^0-9.]/g,'')) || 0,
      montoSoles:   parseFloat((cols[11]||'0').replace(/[^0-9.]/g,'')) || 0,
      tc:           parseFloat((cols[12]||'1').replace(/[^0-9.]/g,'')) || 1,
      cuotas:       parseInt(cols[13]) || 1,
      numOp:        cols[14] || '',
      nota:         cols[15] || '',
    };
  }).filter(Boolean);
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const fmtS = n => 'S/ ' + Math.round(n).toLocaleString('es-PE');
const fmtPct = n => Math.round(n * 100) + '%';

function filterTxns(titular, cat, periodo) {
  return ALL_TXNS.filter(t => {
    const matchTit = titular === 'ambos' || t.titular === titular;
    const matchCat = cat === 'todas' || t.categoria === cat;
    const matchPer = !periodo || t.periodo === periodo;
    return matchTit && matchCat && matchPer;
  });
}

function sumByCat(txns) {
  const res = {};
  CATS.forEach(c => {
    res[c] = {
      ivi:  txns.filter(t => t.titular === 'Ivi'  && t.categoria === c).reduce((a,t) => a + t.montoSoles, 0),
      cris: txns.filter(t => t.titular === 'Cris' && t.categoria === c).reduce((a,t) => a + t.montoSoles, 0),
    };
  });
  return res;
}

// ═══════════════════════════════════════════════════════════
// RENDER — KPIs y semáforo
// ═══════════════════════════════════════════════════════════
function renderKpis(txns) {
  const iviT  = txns.filter(t => t.titular === 'Ivi').reduce((a,t) => a + t.montoSoles, 0);
  const crisT = txns.filter(t => t.titular === 'Cris').reduce((a,t) => a + t.montoSoles, 0);
  const total = iviT + crisT;
  const pct = total / CONFIG.META;
  const restante = Math.max(0, CONFIG.META - total);

  const st = total > CONFIG.META ? 'danger' : total > CONFIG.META * .85 ? 'warn' : 'ok';
  const stClass = { ok: 'kpi-ok', warn: 'kpi-warn', danger: 'kpi-danger' };

  document.getElementById('kpis').innerHTML = `
    <div class="kpi ${stClass[st]}">
      <div class="kpi-label">Total conjunto</div>
      <div class="kpi-val">${fmtS(total)}</div>
      <div class="kpi-sub">${fmtPct(pct)} de S/ 3,000</div>
    </div>
    <div class="kpi ${restante < 600 ? (restante===0?'kpi-danger':'kpi-warn') : 'kpi-ok'}">
      <div class="kpi-label">Disponible</div>
      <div class="kpi-val">${fmtS(restante)}</div>
      <div class="kpi-sub">para llegar a la meta</div>
    </div>
    <div class="kpi kpi-ivi">
      <div class="kpi-label">Ivi (****${CONFIG.IVI_CARD})</div>
      <div class="kpi-val" style="color:${FUCHSIA}">${fmtS(iviT)}</div>
      <div class="kpi-sub">${fmtPct(total > 0 ? iviT/total : 0)} del total</div>
    </div>
    <div class="kpi kpi-cris">
      <div class="kpi-label">Cris (****${CONFIG.CRIS_CARD})</div>
      <div class="kpi-val" style="color:${BLUE}">${fmtS(crisT)}</div>
      <div class="kpi-sub">${fmtPct(total > 0 ? crisT/total : 0)} del total</div>
    </div>`;

  const sem = document.getElementById('semaforo');
  if (total > CONFIG.META) {
    sem.className = 'semaforo sem-danger';
    sem.innerHTML = '&#9888; Meta superada — excedieron en ' + fmtS(total - CONFIG.META);
  } else if (total > CONFIG.META * .85) {
    sem.className = 'semaforo sem-warn';
    sem.innerHTML = '&#9888; Cuidado — quedan solo ' + fmtS(restante) + ' para el límite';
  } else {
    sem.className = 'semaforo sem-ok';
    sem.innerHTML = '&#10003; Van bien — quedan ' + fmtS(restante) + ' disponibles para este período';
  }
}

// ═══════════════════════════════════════════════════════════
// RENDER — vista mensual
// ═══════════════════════════════════════════════════════════
function renderMes() {
  const titular = document.getElementById('sel-titular').value;
  const cat     = document.getElementById('sel-cat').value;
  const periodoId = PERIODOS[parseInt(document.getElementById('sel-mes').value)].label.replace('–','-').trim();
  // Match against periodo field in CSV (may have slight format diff)
  const p = PERIODOS[parseInt(document.getElementById('sel-mes').value)];

  const txns = ALL_TXNS.filter(t => {
    const matchPer = t.periodo.includes(p.id) || t.periodo === p.label ||
                     t.mesPago === p.mes ||
                     matchPeriodo(t.periodo, p);
    const matchTit = titular === 'ambos' || t.titular === titular;
    const matchCat = cat === 'todas' || t.categoria === cat;
    return matchPer && matchTit && matchCat;
  });

  renderKpis(txns);

  const catData = sumByCat(txns);
  const filtered = cat === 'todas' ? CATS : [cat];
  const iviVals  = filtered.map(c => Math.round(catData[c]?.ivi  || 0));
  const crisVals = filtered.map(c => Math.round(catData[c]?.cris || 0));
  const totals   = filtered.map((_,i) => iviVals[i] + crisVals[i]);

  document.getElementById('chart-mes-title').textContent =
    'Gastos por categoría — ' + p.label + ' (' + p.mes + ')';

  if (chartMes) chartMes.destroy();
  chartMes = new Chart(document.getElementById('chart-mes'), {
    type: 'bar',
    data: {
      labels: filtered.map(c => c.length > 12 ? c.slice(0,11)+'…' : c),
      datasets: [
        { label: 'Ivi',  data: iviVals,  backgroundColor: FUCHSIA+'cc',  borderRadius: 3, stack: 's' },
        { label: 'Cris', data: crisVals, backgroundColor: BLUE+'cc', borderRadius: 3, stack: 's' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: S/ ${ctx.parsed.y.toLocaleString('es-PE')}` }}
      },
      scales: {
        x: { ticks: { font: { size: 11 }, maxRotation: 35, autoSkip: false }},
        y: { max: Math.max(Math.max(...totals) * 1.2, 500),
             ticks: { callback: v => 'S/ ' + v.toLocaleString('es-PE'), font: { size: 11 }},
             grid: { color: 'rgba(0,0,0,0.04)' }},
      }
    }
  });

  renderCatTable(txns, 'cat-tbody');
}

function matchPeriodo(periodoStr, p) {
  if (!periodoStr) return false;
  const ps = periodoStr.toLowerCase();
  return ps.includes(p.id.toLowerCase()) ||
         ps.includes(p.mes.toLowerCase()) ||
         ps.includes(p.label.toLowerCase().split('–')[0].trim());
}

// ═══════════════════════════════════════════════════════════
// RENDER — evolutivo anual
// ═══════════════════════════════════════════════════════════
function renderEvolutivo() {
  const iviTots  = PERIODOS.map(p => Math.round(
    ALL_TXNS.filter(t => matchPeriodo(t.periodo, p) && t.titular === 'Ivi').reduce((a,t) => a+t.montoSoles, 0)));
  const crisTots = PERIODOS.map(p => Math.round(
    ALL_TXNS.filter(t => matchPeriodo(t.periodo, p) && t.titular === 'Cris').reduce((a,t) => a+t.montoSoles, 0)));

  if (chartEvo) chartEvo.destroy();
  chartEvo = new Chart(document.getElementById('chart-evo'), {
    type: 'bar',
    data: {
      labels: PERIODOS.map(p => p.mes),
      datasets: [
        { label: 'Ivi',  data: iviTots,  backgroundColor: FUCHSIA+'cc',  borderRadius: 3, stack: 's' },
        { label: 'Cris', data: crisTots, backgroundColor: BLUE+'cc', borderRadius: 3, stack: 's' },
        { label: 'Meta', data: PERIODOS.map(() => CONFIG.META),
          type: 'line', borderColor: RED, borderWidth: 2,
          borderDash: [6,3], pointRadius: 0, fill: false, stack: undefined, order: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { afterBody: items => {
          const i = items[0].dataIndex;
          const tot = iviTots[i] + crisTots[i];
          return ['Total: S/ ' + tot.toLocaleString('es-PE'),
                  tot > CONFIG.META ? '⚠ ' + Math.round(tot-CONFIG.META) + ' sobre meta' : '✓ Dentro de meta'];
        }}}
      },
      scales: {
        x: { ticks: { font: { size: 11 }}},
        y: { max: 3600, ticks: { callback: v => 'S/ '+v.toLocaleString('es-PE'), font: { size: 11 }},
             grid: { color: 'rgba(0,0,0,0.04)' }},
      },
      onClick: (_, els) => { if (els.length) selectEvoMonth(els[0].index, iviTots, crisTots); }
    }
  });

  renderMonthGrid(iviTots, crisTots);
}

function renderMonthGrid(iviTots, crisTots) {
  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';
  PERIODOS.forEach((p, i) => {
    const tot = iviTots[i] + crisTots[i];
    const pct = Math.min(tot / CONFIG.META, 1);
    const barColor = tot > CONFIG.META ? RED : tot > CONFIG.META * .85 ? BLUE : FUCHSIA;
    const isEmpty = tot === 0;
    const card = document.createElement('div');
    card.className = 'month-card';
    card.innerHTML = `
      <div class="mc-name">${p.mes} <span class="mc-label">${p.label}</span></div>
      <div class="mc-total">${isEmpty ? '—' : fmtS(tot)}</div>
      <div class="mc-bar-bg"><div class="mc-bar-fill" style="width:${Math.round(pct*100)}%;background:${barColor}"></div></div>
      <div class="mc-meta">
        <span style="color:${FUCHSIA}">Ivi ${fmtS(iviTots[i])}</span>
        <span style="color:${BLUE}">Cris ${fmtS(crisTots[i])}</span>
        ${!isEmpty ? `<span style="color:${tot>CONFIG.META?RED:GREEN}">${fmtPct(pct)}</span>` : '<span class="muted">sin datos</span>'}
      </div>`;
    card.onclick = () => selectEvoMonth(i, iviTots, crisTots);
    grid.appendChild(card);
  });
}

let evoSelectedIdx = null;
function selectEvoMonth(idx, iviTots, crisTots) {
  evoSelectedIdx = idx;
  const p = PERIODOS[idx];
  const txns = ALL_TXNS.filter(t => matchPeriodo(t.periodo, p));
  const detail = document.getElementById('evo-detail');
  if (!txns.length) { detail.style.display = 'none'; return; }
  detail.style.display = 'block';
  document.getElementById('evo-detail-title').textContent =
    'Desglose — ' + p.mes + ' (' + p.label + ')';
  renderCatTable(txns, 'evo-cat-tbody');
  document.querySelectorAll('.month-card').forEach((c,i) =>
    c.classList.toggle('selected', i === idx));
}

function renderCatTable(txns, tbodyId) {
  const total = txns.reduce((a,t) => a + t.montoSoles, 0);
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  let gIvi = 0, gCris = 0;
  CATS.forEach(c => {
    const iv   = Math.round(txns.filter(t => t.titular==='Ivi'  && t.categoria===c).reduce((a,t)=>a+t.montoSoles,0));
    const cris = Math.round(txns.filter(t => t.titular==='Cris' && t.categoria===c).reduce((a,t)=>a+t.montoSoles,0));
    const tot  = iv + cris;
    if (!tot) return;
    gIvi += iv; gCris += cris;
    const pct = total > 0 ? tot/total : 0;
    tbody.innerHTML += `<tr>
      <td class="td-bold">${c}</td>
      <td class="td-ivi">${fmtS(iv)}</td>
      <td class="td-cris">${fmtS(cris)}</td>
      <td class="td-bold">${fmtS(tot)}</td>
      <td><div class="bar-mini">
        <div class="bar-seg" style="background:${FUCHSIA};width:${Math.round(pct*80)}px"></div>
        <span class="bar-pct">${fmtPct(pct)}</span>
      </div></td>
    </tr>`;
  });
  tbody.innerHTML += `<tr class="tr-total">
    <td>Total</td>
    <td class="td-ivi">${fmtS(gIvi)}</td>
    <td class="td-cris">${fmtS(gCris)}</td>
    <td>${fmtS(gIvi+gCris)}</td>
    <td></td>
  </tr>`;
}

// ═══════════════════════════════════════════════════════════
// RENDER — coordinador
// ═══════════════════════════════════════════════════════════
function renderAll() {
  const view = document.getElementById('app').dataset.view || 'mes';
  if (view === 'mes') renderMes();
  else if (view === 'evolutivo') renderEvolutivo();
  else if (view === 'diario') renderDiario();
}

function setView(v) {
  document.getElementById('app').dataset.view = v;
  document.getElementById('view-mes').style.display = v==='mes' ? 'block' : 'none';
  document.getElementById('view-evo').style.display = v==='evolutivo' ? 'block' : 'none';
  document.getElementById('view-dia').style.display = v==='diario' ? 'block' : 'none';
  document.getElementById('filters-mes').style.display = v==='mes' ? 'flex' : 'none';
  document.getElementById('tab-mes').classList.toggle('active', v==='mes');
  document.getElementById('tab-evo').classList.toggle('active', v==='evolutivo');
  document.getElementById('tab-dia').classList.toggle('active', v==='diario');
  if (v === 'diario') {
    if (!document.getElementById('sel-fecha').value) irHoy();
    else renderDiario();
  } else {
    renderAll();
  }
}


// ═══════════════════════════════════════════════════════════
// VISTA DETALLE DIARIO
// ═══════════════════════════════════════════════════════════
const CAT_COLORS = {
  'Alimentación':      { bg: '#fef3dc', text: '#92400e' },
  'Transporte':        { bg: '#e0f2fe', text: '#075985' },
  'Entretenimiento':   { bg: '#f3e8ff', text: '#6b21a8' },
  'Salud':             { bg: '#fee2e2', text: '#991b1b' },
  'Servicios Básicos': { bg: '#e0e7ff', text: '#3730a3' },
  'Educación':         { bg: '#ecfccb', text: '#3f6212' },
  'Ropa':              { bg: '#fce7f3', text: '#9d174d' },
  'Compras Online':    { bg: '#cffafe', text: '#155e63' },
  'Restaurantes':      { bg: '#ffedd5', text: '#9a3412' },
  'Viajes':            { bg: '#dbeafe', text: '#1e3a8a' },
  'Hogar':             { bg: '#d1fae5', text: '#065f46' },
  'Otros':             { bg: '#f3f4f6', text: '#374151' },
};

function irHoy() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  document.getElementById('sel-fecha').value = `${yyyy}-${mm}-${dd}`;
  renderDiario();
}

function cambiarDia(delta) {
  const input = document.getElementById('sel-fecha');
  const fecha = new Date(input.value + 'T12:00:00');
  fecha.setDate(fecha.getDate() + delta);
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  input.value = `${yyyy}-${mm}-${dd}`;
  renderDiario();
}

function parseFechaTxn(fechaHoraStr) {
  // Formato esperado: "DD/MM/YYYY HH:MM"
  const [fecha, hora] = fechaHoraStr.split(' ');
  if (!fecha) return null;
  const [dd, mm, yyyy] = fecha.split('/');
  if (!dd || !mm || !yyyy) return null;
  return { dd, mm, yyyy, hora: hora || '' };
}

function renderDiario() {
  const fechaSel = document.getElementById('sel-fecha').value; // "YYYY-MM-DD"
  if (!fechaSel) return;
  const [yyyy, mm, dd] = fechaSel.split('-');

  const txnsDia = ALL_TXNS.filter(t => {
    const f = parseFechaTxn(t.fechaHora);
    return f && f.dd === dd && f.mm === mm && f.yyyy === yyyy;
  });

  // Título legible
  const fechaObj = new Date(fechaSel + 'T12:00:00');
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const fechaLegible = fechaObj.toLocaleDateString('es-PE', opciones);
  document.getElementById('dia-title').textContent =
    'Transacciones — ' + fechaLegible.charAt(0).toUpperCase() + fechaLegible.slice(1);

  // KPIs del día
  const totalDia = txnsDia.reduce((a,t) => a + t.montoSoles, 0);
  const iviDia  = txnsDia.filter(t => t.titular === 'Ivi').reduce((a,t) => a + t.montoSoles, 0);
  const crisDia = txnsDia.filter(t => t.titular === 'Cris').reduce((a,t) => a + t.montoSoles, 0);

  document.getElementById('day-kpis').innerHTML = `
    <div class="kpi" style="flex:1;min-width:140px">
      <div class="kpi-label">Total del día</div>
      <div class="kpi-val">${fmtS(totalDia)}</div>
      <div class="kpi-sub">${txnsDia.length} transacción${txnsDia.length !== 1 ? 'es' : ''}</div>
    </div>
    <div class="kpi kpi-ivi" style="flex:1;min-width:140px">
      <div class="kpi-label">Ivi</div>
      <div class="kpi-val" style="color:${FUCHSIA}">${fmtS(iviDia)}</div>
      <div class="kpi-sub">${txnsDia.filter(t=>t.titular==='Ivi').length} transacciones</div>
    </div>
    <div class="kpi kpi-cris" style="flex:1;min-width:140px">
      <div class="kpi-label">Cris</div>
      <div class="kpi-val" style="color:${BLUE}">${fmtS(crisDia)}</div>
      <div class="kpi-sub">${txnsDia.filter(t=>t.titular==='Cris').length} transacciones</div>
    </div>
  `;

  const tabla = document.getElementById('txn-table');
  const vacio = document.getElementById('empty-day');
  const tbody = document.getElementById('txn-tbody');

  if (txnsDia.length === 0) {
    tabla.style.display = 'none';
    vacio.style.display = 'block';
    return;
  }

  tabla.style.display = 'table';
  vacio.style.display = 'none';

  // Ordenar por hora descendente
  txnsDia.sort((a,b) => {
    const fa = parseFechaTxn(a.fechaHora), fb = parseFechaTxn(b.fechaHora);
    return (fb?.hora || '').localeCompare(fa?.hora || '');
  });

  tbody.innerHTML = txnsDia.map(t => {
    const colors = CAT_COLORS[t.categoria] || CAT_COLORS['Otros'];
    const dotColor = t.titular === 'Ivi' ? FUCHSIA : BLUE;
    const montoTxt = t.moneda !== 'PEN'
      ? `${fmtS(t.montoSoles)} <span style="color:var(--muted);font-weight:400;font-size:0.75rem">(${t.moneda} ${t.montoOrig.toFixed(2)})</span>`
      : fmtS(t.montoSoles);
    return `<tr>
      <td class="txn-time">${parseFechaTxn(t.fechaHora)?.hora || '—'}</td>
      <td class="txn-empresa">${t.empresa}${t.subcategoria ? '<br><span style="font-size:0.72rem;color:var(--muted);font-weight:400">'+t.subcategoria+'</span>' : ''}</td>
      <td><span class="txn-cat-badge" style="background:${colors.bg};color:${colors.text}">${t.categoria || 'Sin categoría'}</span></td>
      <td><span class="txn-titular-dot" style="background:${dotColor}"></span>${t.titular}</td>
      <td class="txn-amount">${montoTxt}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Populate month selector
  const selMes = document.getElementById('sel-mes');
  PERIODOS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.mes + ' (' + p.label + ')';
    if (i === 5) opt.selected = true;
    selMes.appendChild(opt);
  });
  // Populate category selector
  const selCat = document.getElementById('sel-cat');
  CATS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    selCat.appendChild(opt);
  });

  fetchData();
  setInterval(fetchData, CONFIG.REFRESH_MS);
});
