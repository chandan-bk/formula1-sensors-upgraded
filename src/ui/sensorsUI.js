import { SENSOR_CATEGORIES, SENSOR_AUTHORITIES, SENSORS, SENSOR_GROUPS } from '../data/sensors.js';
import { CHANNELS, LAP_TIME, TRACK_OUTLINE, speedAt } from '../data/telemetry.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * UI controls for the Motorsport IoT Sensors Network Explorer.
 *
 * Provides:
 *  - Sensors layer toggle chip in the #layers menu
 *  - Floating HUD & Sensor Network panel with:
 *    * Real-time 30 Hz lap HUD (Speed, Gear, RPM, Throttle, Brake)
 *    * Speed-coloured circuit GPS map with car position dot
 *    * Telemetry Controls: Play/Pause, Reset Lap, Replay Lap, 0.5x / 1x / 2x speed rates
 *    * Active Faults indicator & one-click Clear All Faults
 *    * 3D Visual Effect toggles (Live effects, Signal links)
 *    * Subsystem (Control, Monitoring, Instrumentation) and Authority (FIA, Team) filters
 *    * Searchable sensor catalogue with live values, units, and fault pills
 *    * Guided Tour stepping through the car subsystem by subsystem
 */
export function initSensorsUI({ state, sensorsManager, sim, onLayerToggle, onSelect, onEffects, onNetwork }) {
  // 1. "Sensors" toggle chip inside #layers menu
  const layersEl = document.getElementById('layers');
  let sensorChip = null;

  if (layersEl) {
    sensorChip = document.createElement('button');
    sensorChip.className = 'chip off sensor-layer-chip';
    sensorChip.innerHTML = '<span class="sensor-dot"></span>Sensors';
    sensorChip.title = 'Show motorsport IoT sensor network on car';
    sensorChip.addEventListener('click', () => {
      const on = sensorChip.classList.toggle('off') === false;
      state.layers.sensors = on;
      updateVisibility();
      if (onLayerToggle) onLayerToggle('sensors', on);
    });
    layersEl.append(sensorChip);
  }

  // 2. Floating sensor network control panel
  const panel = document.createElement('div');
  panel.id = 'sensors-legend-panel';
  panel.className = 'sensors-panel';
  panel.hidden = true;

  const groupsHtml = SENSOR_GROUPS.map((g) => {
    const rows = SENSORS.filter((s) => s.group === g.id)
      .map((s) => {
        const c = SENSOR_CATEGORIES[s.category].color;
        return `<li><button class="sx-row" data-id="${s.id}" title="${esc(s.plain)}">
            <i style="background:${c}"></i>
            <span class="sx-name">${esc(shortName(s.name))}</span>
            <span class="sx-val-wrap">
              <span class="sx-val" data-v="${s.id}"></span>
              <span class="sx-status-badge" data-sb="${s.id}" hidden></span>
            </span>
          </button></li>`;
      })
      .join('');
    return `<details class="sx-group" data-group="${g.id}">
        <summary><span>${esc(g.label)}</span><em data-gc="${g.id}">${SENSORS.filter((s) => s.group === g.id).length}</em></summary>
        <ul>${rows}</ul>
      </details>`;
  }).join('');

  panel.innerHTML = `
    <div class="sensors-panel-inner">
      <div class="sensors-panel-header">
        <span class="sensors-title">Motorsport IoT Sensors</span>
        <span id="sensors-count" class="sensors-badge">${SENSORS.length} sensors</span>
        <button class="sx-collapse" aria-label="Collapse panel" title="Collapse"></button>
      </div>

      <div class="sx-scroll">
        <p class="sx-intro">32 real-time motorsport IoT sensors and telemetry channels connected to the FIA Standard ECU. Select any sensor to inspect physics and live traces.</p>

        <section class="sx-lap" aria-label="Simulated lap">
          <canvas class="sx-map" width="248" height="150"></canvas>
          <div class="sx-hud">
            <div class="sx-speed"><b data-h="speed">0</b><em>km/h</em></div>
            <div class="sx-gear"><span>Gear</span><b data-h="gear">1</b></div>
            <div class="sx-bars">
              <label>RPM<i><u data-b="rpm"></u></i></label>
              <label>Throttle<i><u data-b="thr" class="g"></u></i></label>
              <label>Brake<i><u data-b="brk" class="r"></u></i></label>
            </div>
          </div>
          <div class="sx-lapctl">
            <div class="sx-ctl-row">
              <button data-play aria-label="Pause simulation" title="Pause or resume the simulated lap">Pause</button>
              <button data-reset aria-label="Reset simulation" title="Reset lap to start line">Reset</button>
              <button data-replay aria-label="Replay simulation" title="Replay lap from start">Replay</button>
              <div class="sx-rates" role="group" aria-label="Simulation speed">
                <button data-rate="0.5">0.5×</button><button data-rate="1" class="on">1×</button><button data-rate="2">2×</button>
              </div>
            </div>
            <div class="sx-lap-info-row">
              <span class="sx-lap-timer" data-lap-timer>Lap 0:00.00</span>
              <span class="sx-lapnote">${LAP_TIME} s Lap · 5,120 m</span>
            </div>
            <div class="sx-faults-bar" data-faults-bar hidden>
              <span class="sx-faults-label" data-faults-text>0 Faults Active</span>
              <button class="sx-clear-faults-btn" data-clear-all-faults title="Restore all sensors to nominal calibration">Clear All Faults</button>
            </div>
          </div>
        </section>

        <div class="sx-toggles">
          <label class="sx-switch" title="Pulsing rings, live glow and sensing-field animations on the car">
            <input type="checkbox" data-fx checked /><i></i><span>Live 3D effects</span>
          </label>
          <label class="sx-switch" title="Draw every sensor's signal path to the ECU">
            <input type="checkbox" data-net /><i></i><span>Show all signal links</span>
          </label>
        </div>

        <div class="sensors-filter-group">
          <span class="filter-label">Subsystem</span>
          <div class="filter-chips" id="cat-filters">
            <button class="sensor-filter-btn active" data-cat="all">All</button>
            <button class="sensor-filter-btn" data-cat="control" title="${esc(SENSOR_CATEGORIES.control.description)}"><i style="background:${SENSOR_CATEGORIES.control.color}"></i>Control</button>
            <button class="sensor-filter-btn" data-cat="monitoring" title="${esc(SENSOR_CATEGORIES.monitoring.description)}"><i style="background:${SENSOR_CATEGORIES.monitoring.color}"></i>Monitoring</button>
            <button class="sensor-filter-btn" data-cat="instrumentation" title="${esc(SENSOR_CATEGORIES.instrumentation.description)}"><i style="background:${SENSOR_CATEGORIES.instrumentation.color}"></i>Instrumentation</button>
          </div>
        </div>

        <div class="sensors-filter-group">
          <span class="filter-label">Authority</span>
          <div class="filter-chips" id="auth-filters">
            <button class="sensor-filter-btn active" data-auth="all">All</button>
            <button class="sensor-filter-btn" data-auth="FIA" title="${esc(SENSOR_AUTHORITIES.FIA.description)}"><i style="background:${SENSOR_AUTHORITIES.FIA.badgeColor}"></i>FIA Mandatory</button>
            <button class="sensor-filter-btn" data-auth="Team" title="${esc(SENSOR_AUTHORITIES.Team.description)}"><i style="background:${SENSOR_AUTHORITIES.Team.badgeColor}"></i>Team Engineering</button>
          </div>
        </div>

        <div class="sx-list-head">
          <input type="search" class="sx-search" placeholder="Search 32 sensors by name, location, or parameter…" autocomplete="off" aria-label="Search sensors" />
          <button class="sx-tour" title="Step through every sensor, subsystem by subsystem">Start tour</button>
        </div>
        <div class="sx-list">${groupsHtml}<p class="sx-empty" hidden>No sensors match these filters.</p></div>

        <div class="sensors-confidential-note">
          Simulated telemetry model aligned with 2026 FIA Technical Regulations. Team proprietary configurations are confidential.
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const $$ = (sel) => [...panel.querySelectorAll(sel)];

  /* ---------------- filters ---------------- */
  const catButtons = $$('[data-cat]');
  catButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      catButtons.forEach((b) => b.classList.toggle('active', b === btn));
      sensorsManager.setFilters({ category: btn.dataset.cat });
      refreshList();
      updateCount();
    }),
  );

  const authButtons = $$('[data-auth]');
  authButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      authButtons.forEach((b) => b.classList.toggle('active', b === btn));
      sensorsManager.setFilters({ authority: btn.dataset.auth });
      refreshList();
      updateCount();
    }),
  );

  /* ---------------- list ---------------- */
  const search = $('.sx-search');
  const rows = new Map($$('.sx-row').map((b) => [b.dataset.id, b]));
  const sensorById = new Map(SENSORS.map((s) => [s.id, s]));

  function refreshList() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const [id, btn] of rows) {
      const s = sensorById.get(id);
      const hay = `${s.name} ${s.measures} ${s.group} ${s.locationDesc || ''} ${s.id}`.toLowerCase();
      const ok = sensorsManager.matchesFilter(s) && (!q || hay.includes(q));
      btn.parentElement.hidden = !ok;
      if (ok) shown++;
    }
    for (const g of $$('.sx-group')) {
      const vis = [...g.querySelectorAll('li')].filter((li) => !li.hidden).length;
      g.hidden = vis === 0;
      g.querySelector('[data-gc]').textContent = vis;
      if (q && vis) g.open = true;
    }
    $('.sx-empty').hidden = shown > 0;
  }
  search.addEventListener('input', refreshList);

  for (const [id, btn] of rows) btn.addEventListener('click', () => onSelect?.(sensorById.get(id)));

  $('.sx-tour').addEventListener('click', () => {
    catButtons[0].click();
    authButtons[0].click();
    search.value = '';
    refreshList();
    onSelect?.(SENSORS[0]);
  });

  /* ---------------- toggles ---------------- */
  $('[data-fx]').addEventListener('change', (e) => onEffects?.(e.target.checked));
  $('[data-net]').addEventListener('change', (e) => onNetwork?.(e.target.checked));

  /* ---------------- collapse (starts collapsed on small screens) ---------------- */
  const collapseBtn = $('.sx-collapse');
  const setCollapsed = (c) => {
    panel.classList.toggle('collapsed', c);
    collapseBtn.setAttribute('aria-expanded', String(!c));
  };
  collapseBtn.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  if (window.innerWidth < 700) setCollapsed(true);

  /* ---------------- simulation controls ---------------- */
  const playBtn = $('[data-play]');
  playBtn.addEventListener('click', () => {
    sim.running = !sim.running;
    playBtn.textContent = sim.running ? 'Pause' : 'Play';
  });

  const resetBtn = $('[data-reset]');
  resetBtn.addEventListener('click', () => {
    sim.reset();
    playBtn.textContent = sim.running ? 'Pause' : 'Play';
  });

  const replayBtn = $('[data-replay]');
  replayBtn.addEventListener('click', () => {
    sim.replay();
    playBtn.textContent = 'Pause';
  });

  const clearAllFaultsBtn = $('[data-clear-all-faults]');
  clearAllFaultsBtn?.addEventListener('click', () => {
    sim.clearAllFaults();
    updateFaultsBar();
  });

  const rateBtns = $$('[data-rate]');
  rateBtns.forEach((b) =>
    b.addEventListener('click', () => {
      sim.rate = Number(b.dataset.rate);
      rateBtns.forEach((x) => x.classList.toggle('on', x === b));
    }),
  );

  /* Keyboard shortcut: Space pauses/plays simulation */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName)) {
      e.preventDefault();
      sim.running = !sim.running;
      playBtn.textContent = sim.running ? 'Pause' : 'Play';
    }
  });

  /* ---------------- mini track map ---------------- */
  const map = $('.sx-map');
  const mctx = map.getContext('2d');
  const track = buildTrack(map.width, map.height);
  const hudEls = {
    speed: $('[data-h="speed"]'),
    gear: $('[data-h="gear"]'),
    rpm: $('[data-b="rpm"]'),
    thr: $('[data-b="thr"]'),
    brk: $('[data-b="brk"]'),
    timer: $('[data-lap-timer]'),
    faultsBar: $('[data-faults-bar]'),
    faultsText: $('[data-faults-text]'),
  };

  function drawMap() {
    mctx.clearRect(0, 0, map.width, map.height);
    mctx.drawImage(track.layer, 0, 0);
    const p = track.at(sim.state.phase);
    // trailing glow behind car
    for (let i = 1; i <= 10; i++) {
      const q = track.at((sim.state.phase - i * 0.004 + 1) % 1);
      mctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - i / 11)})`;
      mctx.beginPath();
      mctx.arc(q.x, q.y, 3.2 - i * 0.2, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.fillStyle = '#fff';
    mctx.shadowColor = '#fff';
    mctx.shadowBlur = 10;
    mctx.beginPath();
    mctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
    mctx.fill();
    mctx.shadowBlur = 0;
  }

  function updateFaultsBar() {
    const faultCount = sim.faults?.size || 0;
    if (hudEls.faultsBar) {
      hudEls.faultsBar.hidden = faultCount === 0;
      if (hudEls.faultsText) {
        hudEls.faultsText.textContent = `${faultCount} Active Sensor Fault${faultCount > 1 ? 's' : ''}`;
      }
    }
  }

  /* ---------------- per-frame update ---------------- */
  let lastHud = 0;
  function update(now) {
    if (panel.hidden || panel.classList.contains('collapsed')) return;
    drawMap();
    if (now - lastHud < 80) return;
    lastHud = now;

    const s = sim.state;
    hudEls.speed.textContent = Math.round(s.speed);
    hudEls.gear.textContent = s.gear;
    hudEls.rpm.style.width = `${((s.rpm - 4000) / 11000) * 100}%`;
    hudEls.thr.style.width = `${s.throttle}%`;
    hudEls.brk.style.width = `${s.brake}%`;

    const ts = sim.getTimestamp ? sim.getTimestamp() : { formattedTime: '0:00' };
    if (hudEls.timer) hudEls.timer.textContent = `Lap ${ts.formattedTime}`;

    updateFaultsBar();

    // Update list rows
    for (const g of $$('.sx-group[open]')) {
      for (const el of g.querySelectorAll('li:not([hidden]) [data-v]')) {
        const sensor = sensorById.get(el.dataset.v);
        if (!sensor) continue;
        const key = sensor.live;
        const c = CHANNELS[key];
        el.textContent = `${sim.format(key)}${c.unit && !c.text ? ` ${c.unit}` : ''}`;

        // Status badge
        const badgeEl = g.querySelector(`[data-sb="${sensor.id}"]`);
        if (badgeEl) {
          const status = sim.getStatus(key);
          if (status.severity !== 'nominal') {
            badgeEl.hidden = false;
            badgeEl.textContent = status.code || 'ALERT';
            badgeEl.className = `sx-status-badge ${status.severity}`;
          } else {
            badgeEl.hidden = true;
          }
        }
      }
    }
  }

  function setActive(sensor) {
    for (const [id, btn] of rows) btn.classList.toggle('on', id === sensor?.id);
    if (sensor) {
      const g = panel.querySelector(`.sx-group[data-group="${sensor.group}"]`);
      if (g && !g.open) g.open = true;
      rows.get(sensor.id)?.scrollIntoView({ block: 'nearest' });
    }
  }

  function updateCount() {
    const visibleCount = sensorsManager.markers.filter((m) => m.group.visible).length;
    const countEl = document.getElementById('sensors-count');
    if (countEl) countEl.textContent = `${visibleCount} on car`;
  }

  function updateVisibility() {
    const on = !!state.layers.sensors;
    panel.hidden = !on;
    if (sensorChip) sensorChip.classList.toggle('off', !on);
    sensorsManager.syncVisibility();
    updateCount();
    refreshList();
  }

  refreshList();
  return {
    sync() {
      updateVisibility();
    },
    updateCount,
    update,
    setActive,
  };
}

/** Trim catalogue names for clean list row appearance */
function shortName(name) {
  return name
    .replace(/^FIA /, '')
    .replace(/ \(.*\)$/, '')
    .replace(/Dynamic |High-Bandwidth |Linear |Optical |Telemetry |Chassis /g, '')
    .replace(/ Sensors?$/, '');
}

/** Pre-render circuit coloured by speed */
function buildTrack(W, H) {
  const pts = TRACK_OUTLINE.map(([x, y]) => [x * W, y * H * 0.98 + 2]);
  const samples = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let k = 0; k < 16; k++) {
      const t = k / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  const cum = [0];
  for (let i = 1; i <= samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i % samples.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1];

  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const g = layer.getContext('2d');
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 9;
  g.beginPath();
  samples.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();

  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    const v = speedAt(cum[i] / total);
    const u = Math.min(1, Math.max(0, (v - 80) / 240));
    g.strokeStyle = `hsl(${Math.round(350 - u * 160)} 85% ${48 + u * 8}%)`;
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }

  // start / finish tick
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(samples[0][0] - 1, samples[0][1] - 7);
  g.lineTo(samples[0][0] - 1, samples[0][1] + 7);
  g.stroke();

  return {
    layer,
    at(phase) {
      const d = phase * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid;
      }
      const a = samples[lo % samples.length];
      const b = samples[(lo + 1) % samples.length];
      const u = (d - cum[lo]) / Math.max(1e-6, cum[lo + 1] - cum[lo]);
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u };
    },
  };
}
