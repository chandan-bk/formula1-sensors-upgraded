import * as THREE from 'three';
import { CATEGORIES } from '../data/parts.js';
import { mountSensorPreview, unmountSensorPreview } from './sensorPreview.js';
import { SENSORS, SENSOR_GROUPS, SENSOR_CATEGORIES, SENSOR_AUTHORITIES, SENSOR_TYPES } from '../data/sensors.js';
import { explainStage, ARCHITECTURE_STAGES } from '../data/sensorDetails.js';
import { CHANNELS, LAP_TIME, FAULT_MODES } from '../data/telemetry.js';
import { LiveScope } from './liveScope.js';

const FREEDOM = ['None', 'Minimal', 'Limited', 'Substantial', 'High'];
const NS = 'http://www.w3.org/2000/svg';

/** Vertical screen span between the top and bottom toolbars. */
function freeBounds(h) {
  const top = document.getElementById('topbar')?.getBoundingClientRect().bottom ?? 0;
  const bottom = document.getElementById('bottombar')?.getBoundingClientRect().top ?? h;
  return { T: top + 12, B: bottom - 12 };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Floating info card connected to a 3D component by an SVG leader line.
 * Fully supports:
 *   - FIA Regulations Part Explanations
 *   - 32 Motorsport IoT Sensors with Live Telemetry, Scope Traces, and Interactive Fault Simulation
 *   - 360-degree Turntable 3D Inspector
 *   - End-to-End 6-Stage Telemetry Architecture Visualizer
 *   - Internal smooth scrolling with sticky header and pinned close button
 *   - Smooth draggable repositioning clamped within browser viewport
 */
export class Callout {
  constructor({ card, svg, camera, renderer, onClose, onFocusSensor, onNavigate, sim }) {
    this.onFocusSensor = onFocusSensor;
    this.onNavigate = onNavigate;
    this.sim = sim;
    this.scope = null;
    this.live = null;
    this.tab = 'what';
    this._tickAt = 0;
    this.onClose = onClose;
    this.card = card;
    this.svg = svg;
    this.camera = camera;
    this.renderer = renderer;
    this.part = null;
    this.infoId = null;
    this.anchorLocal = new THREE.Vector3();
    this.pos = null;
    this.draggedPos = null;
    this.isDragging = false;
    this.side = 1;
    this.visible = false;

    this.path = document.createElementNS(NS, 'path');
    this.path.setAttribute('class', 'callout-line');
    this.dot = document.createElementNS(NS, 'circle');
    this.dot.setAttribute('class', 'callout-dot');
    this.dot.setAttribute('r', '4');
    this.ring = document.createElementNS(NS, 'circle');
    this.ring.setAttribute('class', 'callout-ring');
    this.ring.setAttribute('r', '6');
    svg.append(this.path, this.ring, this.dot);
    this.setSvgVisible(false);

    this.setupDraggable();
  }

  setSvgVisible(v) {
    for (const el of [this.path, this.dot, this.ring]) el.style.display = v ? '' : 'none';
  }

  setupDraggable() {
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;
    let dragging = false;
    let pointerCaptured = false;
    let activePointerId = null;

    const onPointerDown = (e) => {
      // Only drag pinned, visible panels
      if (!this.pinned || !this.visible) return;
      // Primary mouse button or touch
      if (e.button !== undefined && e.button !== 0) return;

      // Do not initiate drag from interactive controls
      if (e.target.closest('button, a, input, select, textarea, canvas, .no-drag, [role="tab"]')) {
        return;
      }

      // Must be initiated from the card header
      const header = e.target.closest('.card-header');
      if (!header) return;

      const rect = this.card.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origX = this.pos?.x ?? rect.left;
      origY = this.pos?.y ?? rect.top;
      activePointerId = e.pointerId;

      const onPointerMove = (ev) => {
        if (ev.pointerId !== activePointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!dragging) {
          // Threshold to prevent accidental drags during plain clicks
          if (Math.hypot(dx, dy) < 4) return;
          dragging = true;
          this.isDragging = true;
          this.card.classList.add('is-dragging');
          document.body.classList.add('callout-dragging-active');
          window.getSelection()?.removeAllRanges();
          try {
            header.setPointerCapture(activePointerId);
            pointerCaptured = true;
          } catch (_) {}
        }

        const cw = this.card.offsetWidth;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const fb = freeBounds(h);

        const L = 12;
        const R = w - 12;
        const minX = L;
        const maxX = Math.max(L, R - cw);
        const minY = Math.max(12, fb.T - 20);
        const minCardH = 260;
        const maxY = Math.max(minY, fb.B - minCardH);

        let nx = origX + dx;
        let ny = origY + dy;

        nx = THREE.MathUtils.clamp(nx, minX, maxX);
        ny = THREE.MathUtils.clamp(ny, minY, maxY);

        this.draggedPos = { x: nx, y: ny };
        this.pos = { x: nx, y: ny };

        const maxH = Math.max(minCardH, fb.B - ny);
        this.card.style.maxHeight = `${maxH}px`;
        this.card.style.left = `${nx.toFixed(1)}px`;
        this.card.style.top = `${ny.toFixed(1)}px`;

        this.updateLeaderLineDirect();
      };

      const onPointerUp = (ev) => {
        if (ev.pointerId !== activePointerId) return;
        if (dragging) {
          dragging = false;
          this.isDragging = false;
          this.card.classList.remove('is-dragging');
          document.body.classList.remove('callout-dragging-active');
          if (pointerCaptured) {
            try {
              header.releasePointerCapture(ev.pointerId);
            } catch (_) {}
            pointerCaptured = false;
          }
        }
        activePointerId = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    this.card.addEventListener('pointerdown', onPointerDown);

    window.addEventListener('resize', () => {
      if (!this.visible || !this.pos) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cw = this.card.offsetWidth;
      const fb = freeBounds(h);
      const L = 12;
      const R = w - 12;
      const minX = L;
      const maxX = Math.max(L, R - cw);
      const minY = Math.max(12, fb.T - 20);
      const minCardH = 260;
      const maxY = Math.max(minY, fb.B - minCardH);

      if (this.draggedPos) {
        this.draggedPos.x = THREE.MathUtils.clamp(this.draggedPos.x, minX, maxX);
        this.draggedPos.y = THREE.MathUtils.clamp(this.draggedPos.y, minY, maxY);
        this.pos = { x: this.draggedPos.x, y: this.draggedPos.y };
      } else {
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, minX, maxX);
        this.pos.y = THREE.MathUtils.clamp(this.pos.y, minY, maxY);
      }
      const curY = this.pos.y;
      this.card.style.maxHeight = `${Math.max(minCardH, fb.B - curY)}px`;
      this.card.style.left = `${this.pos.x.toFixed(1)}px`;
      this.card.style.top = `${this.pos.y.toFixed(1)}px`;
    });
  }

  updateLeaderLineDirect() {
    if (!this.visible || !this.part || !this.pos) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const world = this.part.localToWorld(this.anchorLocal.clone());
    const ndc = world.clone().project(this.camera);
    const behind = ndc.z > 1;
    if (behind) {
      this.setSvgVisible(false);
      return;
    }
    this.setSvgVisible(true);
    const ax = (ndc.x * 0.5 + 0.5) * w;
    const ay = (-ndc.y * 0.5 + 0.5) * h;
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    const edgeX = ax < this.pos.x + cw / 2 ? this.pos.x : this.pos.x + cw;
    const edgeY = THREE.MathUtils.clamp(ay, this.pos.y + 24, this.pos.y + ch - 24);
    const dir = edgeX > ax ? 1 : -1;
    const elbowX = edgeX - dir * 28;
    this.path.setAttribute('d', `M${ax},${ay} L${elbowX},${edgeY} L${edgeX},${edgeY}`);
    this.dot.setAttribute('cx', ax);
    this.dot.setAttribute('cy', ay);
    this.ring.setAttribute('cx', ax);
    this.ring.setAttribute('cy', ay);
  }

  show(info, infoId, part, pointWorld, pinned) {
    if (!info) return;
    const newContent = infoId !== this.infoId || pinned !== this.pinned;
    this.part = part;
    part.updateMatrixWorld(true);
    this.anchorLocal.copy(part.worldToLocal(pointWorld.clone()));
    if (newContent) {
      this.infoId = infoId;
      this.pinned = pinned;
      this.render(info, pinned);
      if (!this.draggedPos) {
        this.pos = null; // re-seat the card next to the new anchor
      }
    }
    if (!this.visible) {
      this.card.hidden = false;
      requestAnimationFrame(() => this.card.classList.add('show'));
      this.visible = true;
      if (!this.draggedPos) {
        this.pos = null;
      }
    }
    this.card.classList.toggle('pinned', pinned);
    this.setSvgVisible(true);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.infoId = null;
    this.part = null;
    this.draggedPos = null; // reset user manual positioning on close
    this.isDragging = false;
    this.teardownSensor();
    this.card.classList.remove('show', 'pinned', 'sensor', 'sensor-compact', 'is-dragging');
    document.body.classList.remove('callout-dragging-active');
    this.setSvgVisible(false);
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (!this.visible) this.card.hidden = true;
    }, 180);
  }

  render(info, pinned) {
    this.teardownSensor();
    if (info.measures) {
      this.renderSensor(info, pinned);
      return;
    }
    this.card.classList.remove('sensor', 'sensor-compact');
    const cat = CATEGORIES[info.cat];
    this.path.style.stroke = 'rgba(238, 236, 233, 0.7)';
    this.dot.style.fill = '#131212';
    this.dot.style.stroke = '#eeece9';
    this.ring.style.stroke = '#eeece9';
    const bars = [0, 1, 2, 3].map((i) => `<span class="${i < info.freedom ? 'on' : ''}"></span>`).join('');
    this.card.innerHTML = `
      <div class="card-header">
        ${pinned ? `
        <div class="card-drag-indicator" title="Drag to reposition panel">
          <span class="card-drag-grip"></span>
        </div>` : ''}
        <div class="cat-row">
          <span class="cat"><i style="background:${cat.color}"></i>${esc(cat.label)}</span>
          ${pinned ? '<button class="close" aria-label="Close" title="Close details (Esc)"></button>' : '<span class="pin">Click to pin</span>'}
        </div>
        <h3>${esc(info.name)}</h3>
      </div>
      <div class="card-scroll-area">
        <p>${esc(info.summary)}</p>
        <p><b>Who makes it:</b> ${esc(cat.who)}</p>
        <div class="freedom">Team design freedom <div class="bars">${bars}</div><em>${FREEDOM[info.freedom]}</em></div>
        <ul>${info.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${info.numbers?.length ? `<p>${info.numbers.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join(' · ')}</p>` : ''}
        ${info.isNew ? `<p><b>New for 2026:</b> ${esc(info.isNew)}</p>` : ''}
      </div>
    `;
    this.card.querySelector('.close')?.addEventListener('click', () => this.onClose?.());
  }

  teardownSensor() {
    unmountSensorPreview();
    this.scope = null;
    this.live = null;
  }

  /** Render Sensor detail card: hover shows compact preview, click pins full technical suite */
  renderSensor(sensor, pinned) {
    const cat = SENSOR_CATEGORIES[sensor.category];
    const auth = SENSOR_AUTHORITIES[sensor.authority];
    const typeDef = SENSOR_TYPES[sensor.sensorType] || SENSOR_TYPES.physical;
    const catColor = cat.color;
    const authColor = auth.badgeColor;
    const group = SENSOR_GROUPS.find((g) => g.id === sensor.group);
    const ch = CHANNELS[sensor.live];

    this.path.style.stroke = catColor;
    this.dot.style.fill = '#131212';
    this.dot.style.stroke = catColor;
    this.ring.style.stroke = catColor;

    this.card.classList.add('sensor');
    this.card.classList.toggle('sensor-compact', !pinned);
    this.card.style.setProperty('--sc', catColor);

    const buildHeader = (isPinned) => `
      <div class="card-header sensor-header">
        ${isPinned ? `
        <div class="card-drag-indicator" title="Drag to reposition panel">
          <span class="card-drag-grip"></span>
        </div>` : ''}
        <div class="cat-row">
          <span class="cat"><i style="background:${catColor}"></i>${esc(cat.short)}<span class="cat-sep">in</span>${esc(group?.label ?? '')}</span>
          <span class="sensor-auth-badge" style="background:${authColor}22; color:${authColor}; border:1px solid ${authColor}55;" title="${esc(auth?.description || '')}">
            ${esc(auth?.short || (sensor.authority === 'FIA' ? 'FIA-Mandated' : 'Team Instrumentation'))}
          </span>
          <span class="sensor-type-pill" title="${esc(typeDef.description)}">
            ${esc(typeDef.label)}
          </span>
          ${isPinned ? '<button class="close" aria-label="Close" title="Close details (Esc)"></button>' : ''}
        </div>
        <h3 class="sensor-title">${esc(sensor.name)}</h3>
        <p class="sensor-plain">${esc(sensor.plain)}</p>
        <div class="sensor-meta-tags">
          <span class="sensor-loc-tag" title="Physical Installation Point">📍 ${esc(sensor.locationDesc || 'Chassis')}</span>
          <span class="sensor-part-tag" title="Connected Subsystem Component">🔗 ${esc(sensor.connectedComponent || 'Vehicle Sub-Loom')}</span>
        </div>
      </div>`;

    const liveBlock = `
      <div class="sensor-live">
        <div class="live-read">
          <div class="live-title-col">
            <span class="live-label">${esc(ch.label)}</span>
            <span class="live-meta-stream" data-live="stream">30 Hz Ingest · Active Lap</span>
          </div>
          <span class="live-value"><b data-live="value">–</b><em>${esc(ch.unit)}</em></span>
          <span class="live-status nominal" data-live="status">Nominal</span>
        </div>
        <canvas class="live-scope" data-live="scope"></canvas>
      </div>`;

    if (!pinned) {
      this.card.innerHTML = `
        ${buildHeader(false)}
        <div class="card-scroll-area">
          ${liveBlock}
          <p class="pin-hint">Click sensor marker on car to pin full telemetry suite</p>
        </div>
      `;
      this.attachLive(sensor, catColor, true);
      return;
    }

    const idx = SENSORS.indexOf(sensor);
    const stages = sensor.dataPath.split(/\s*->\s*/);
    const note = sensor.notes ?? [];
    const readings = Math.round((sensor.hz || 100) * LAP_TIME);
    const fmtHz = sensor.hz >= 1000 ? `${(sensor.hz / 1000).toString().replace(/\.0$/, '')} kHz` : `${sensor.hz} Hz`;

    // Interactive Fault Suite
    const faultControls = `
      <div class="fault-suite-box">
        <div class="fault-suite-head">
          <span class="fault-suite-title">⚡ Sensor Fault & Anomaly Injection</span>
          <span class="fault-suite-hint">Inject real-world motorsport failure modes to verify fail-safe response:</span>
        </div>
        <div class="fault-buttons-grid" role="group" aria-label="Sensor fault simulation modes">
          <button class="fault-btn on" data-fault="none" title="Nominal baseline calibration">Nominal</button>
          <button class="fault-btn" data-fault="disconnected" title="Wiring disconnection / open circuit">Disconnect</button>
          <button class="fault-btn" data-fault="stuck" title="Frozen ADC reading / seized linkage">Stuck ADC</button>
          <button class="fault-btn" data-fault="noisy" title="High-voltage MGU-K inverter EMI noise">EMI Noise</button>
          <button class="fault-btn" data-fault="out_of_range" title="Positive supply rail electrical saturation">Out-of-Range</button>
          <button class="fault-btn" data-fault="delayed" title="Simulated CAN buffer queue latency">CAN Delay</button>
          <button class="fault-btn" data-fault="intermittent" title="Vibration induced contact bounce">Intermittent</button>
        </div>
        <div class="fault-diagnostic-alert" data-fault-alert hidden>
          <div class="fault-alert-header">
            <span class="fault-alert-badge" data-fault-badge>FAULT ACTIVE</span>
            <span class="fault-alert-code" data-fault-code>ERR</span>
          </div>
          <p class="fault-alert-desc" data-fault-desc></p>
          <div class="fault-alert-investigate">
            <b>Race Engineer Diagnostic Action:</b>
            <p data-fault-investigation></p>
          </div>
          <button class="fault-restore-btn" data-fault-restore>Restore Channel to Nominal</button>
        </div>
      </div>`;

    // Tab 1: What it does
    const tabWhat = `
      <div class="tab-panel" data-panel="what">
        <div class="spec-row-item">
          <b>Primary Measurement:</b> <span>${esc(sensor.measures)}</span>
        </div>
        <div class="spec-row-item">
          <b>Why it matters:</b> <span>${esc(sensor.whyItMatters)}</span>
        </div>
        <div class="sensor-note read">
          <span>How engineers read the trace</span>
          ${esc(sensor.reading)}
        </div>
        <div class="sensor-note fail">
          <span>System response if sensor fails</span>
          ${esc(sensor.failure)}
        </div>
        <div class="sensor-note checklist">
          <span>Pit wall diagnostic investigation checklist</span>
          ${esc(sensor.investigation || 'Inspect wiring loom continuity, check excitation supply voltage, clean sensing element face, and verify CAN bus termination resistance.')}
        </div>
      </div>`;

    // Tab 2: How it works
    const tabHow = `
      <div class="tab-panel" data-panel="how" hidden>
        <p class="principle-text">${esc(sensor.principle)}</p>
        <dl class="spec-grid">
          ${sensor.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>

        <div class="thresholds-summary-table">
          <h4>Operating Thresholds & Calibrated Window</h4>
          <div class="threshold-chips">
            <div class="thresh-chip green">
              <span class="tc-label">Ideal Window</span>
              <span class="tc-val">${ch.bandLo !== undefined ? `${ch.bandLo} – ${ch.bandHi} ${ch.unit}` : 'Standard'}</span>
            </div>
            <div class="thresh-chip amber">
              <span class="tc-label">Warning Limit</span>
              <span class="tc-val">${ch.warnHi !== undefined ? `> ${ch.warnHi} ${ch.unit}` : ch.warnLo !== undefined ? `< ${ch.warnLo} ${ch.unit}` : '±10%'}</span>
            </div>
            <div class="thresh-chip red">
              <span class="tc-label">Critical Alarm</span>
              <span class="tc-val">${ch.critHi !== undefined ? `> ${ch.critHi} ${ch.unit}` : ch.critLo !== undefined ? `< ${ch.critLo} ${ch.unit}` : 'Hard Limit'}</span>
            </div>
          </div>
        </div>

        <p class="spec-fine">Sampled continuously at ${esc(fmtHz)}, producing ~${readings.toLocaleString('en-US')} discrete readings over each ${LAP_TIME} s lap.</p>
        <p class="spec-fine academic-note">
          <b>Engineering Education Note:</b> Values shown are physically coupled via an illustrative lap vehicle dynamics model (src/data/telemetry.js). In actual F1 competition, team proprietary calibrations remain strictly confidential.
        </p>
      </div>`;

    // Tab 3: Signal path
    const tabPath = `
      <div class="tab-panel" data-panel="path" hidden>
        <p class="spec-fine path-intro">Follow this telemetry channel from physical transducer acquisition through vehicle networks to trackside race strategy:</p>
        <div class="architecture-diagram-container">
          <ol class="stage-list">
            ${ARCHITECTURE_STAGES.map((st, i) => `
              <li class="arch-stage-item" style="--i:${i}">
                <div class="stage-dot"></div>
                <div class="stage-content">
                  <div class="stage-top">
                    <b>${esc(st.label)}</b>
                    <span class="stage-type-tag">${esc(st.type)}</span>
                  </div>
                  <p>${esc(st.desc)}</p>
                </div>
              </li>
            `).join('')}
          </ol>
        </div>
        <div class="path-simulation-notice">
          ℹ️ <b>System Architecture Notice:</b> Stages 1–3 represent vehicle electronics hardware concepts. Stage 4 models the McLaren Applied TAG-320 SECU concept. In this web application, vehicle physics, CAN message queuing, and radio telemetry streaming are running inside the client-side JavaScript simulation engine.
        </div>
      </div>`;

    this.card.innerHTML = `
      ${buildHeader(true)}
      <div class="card-scroll-area">
        <div class="sensor-3d-turntable-container" id="sensor-preview-slot"></div>
        ${liveBlock}
        ${faultControls}
        <div class="sensor-tabs" role="tablist">
          <button role="tab" data-tab="what" class="on">What it does</button>
          <button role="tab" data-tab="how">How it works</button>
          <button role="tab" data-tab="path">Signal path</button>
        </div>
        <div class="sensor-body">${tabWhat}${tabHow}${tabPath}</div>
        <div class="sensor-nav">
          <button data-nav="-1" aria-label="Previous sensor" title="Previous sensor">‹</button>
          <span><b>${idx + 1}</b> of ${SENSORS.length} · ${esc(group?.label ?? '')}</span>
          <button data-nav="1" aria-label="Next sensor" title="Next sensor">›</button>
        </div>
      </div>
    `;

    // Wire up events
    this.card.querySelector('.close')?.addEventListener('click', () => this.onClose?.());
    this.card.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => this.onNavigate?.(Number(b.dataset.nav))));
    this.card.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));

    // Wire up fault buttons
    const faultBtns = this.card.querySelectorAll('[data-fault]');
    faultBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.fault;
        this.sim?.injectFault(sensor.live, mode);
        faultBtns.forEach((b) => b.classList.toggle('on', b === btn));
        this.updateFaultAlert(sensor);
      });
    });

    const restoreBtn = this.card.querySelector('[data-fault-restore]');
    restoreBtn?.addEventListener('click', () => {
      this.sim?.clearFault(sensor.live);
      faultBtns.forEach((b) => b.classList.toggle('on', b.dataset.fault === 'none'));
      this.updateFaultAlert(sensor);
    });

    this.setTab(this.tab);
    this.attachLive(sensor, catColor, false);
    this.updateFaultAlert(sensor);

    const slot = this.card.querySelector('#sensor-preview-slot');
    if (slot) {
      mountSensorPreview(slot, sensor.id, {
        onFocus: () => this.onFocusSensor?.(sensor, this.part),
      });
    }
  }

  updateFaultAlert(sensor) {
    if (!this.sim) return;
    const alertBox = this.card.querySelector('[data-fault-alert]');
    if (!alertBox) return;

    const fault = this.sim.getFault(sensor.live);
    if (!fault) {
      alertBox.hidden = true;
      return;
    }

    const def = FAULT_MODES[fault.type] || FAULT_MODES.none;
    alertBox.hidden = false;
    alertBox.className = `fault-diagnostic-alert ${def.severity}`;

    const badge = alertBox.querySelector('[data-fault-badge]');
    const code = alertBox.querySelector('[data-fault-code]');
    const desc = alertBox.querySelector('[data-fault-desc]');
    const inv = alertBox.querySelector('[data-fault-investigation]');

    if (badge) badge.textContent = `FAULT: ${def.label.toUpperCase()}`;
    if (code) code.textContent = def.code;
    if (desc) desc.textContent = def.description;
    if (inv) inv.textContent = sensor.investigation || def.investigation;
  }

  setTab(tab) {
    this.tab = tab;
    this.card.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    this.card.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  attachLive(sensor, color, compact) {
    const q = (k) => this.card.querySelector(`[data-live="${k}"]`);
    this.live = {
      sensor,
      valueEl: q('value'),
      statusEl: q('status'),
      streamEl: q('stream'),
      ch: CHANNELS[sensor.live],
    };
    const canvas = q('scope');
    this.scope = this.sim && canvas ? new LiveScope(canvas, this.sim, sensor.live, color, { compact }) : null;
    this._tickAt = 0;
    this.tickLive(performance.now(), true);
  }

  /** Update live telemetry values, health status, and oscilloscope traces */
  tickLive(now, force = false) {
    if (!this.live || !this.sim) return;
    this.scope?.draw();
    if (!force && now - this._tickAt < 65) return;
    this._tickAt = now;

    const { valueEl, statusEl, streamEl, ch, sensor } = this.live;
    const v = this.sim.state[sensor.live];

    if (valueEl) valueEl.textContent = this.sim.format(sensor.live);

    const status = this.sim.getStatus(sensor.live);
    if (statusEl) {
      statusEl.textContent = status.text;
      statusEl.className = `live-status ${status.severity}`;
      if (status.fault) statusEl.classList.add('fault');
    }

    if (streamEl) {
      const ts = this.sim.getTimestamp();
      streamEl.textContent = `Lap ${ts.formattedTime} · ${ts.distM}m · 30Hz`;
    }
  }

  update() {
    if (!this.visible || !this.part) return;
    this.tickLive(performance.now());
    const w = window.innerWidth;
    const h = window.innerHeight;
    const world = this.part.localToWorld(this.anchorLocal.clone());
    const ndc = world.clone().project(this.camera);
    const behind = ndc.z > 1;
    const ax = (ndc.x * 0.5 + 0.5) * w;
    const ay = (-ndc.y * 0.5 + 0.5) * h;

    const cw = this.card.offsetWidth;
    const fb = freeBounds(h);
    const L = 16;
    const R = w - 16;
    const { T, B } = fb;
    const minCardH = 260;
    const gap = 90;
    const totalRoomH = Math.max(minCardH, B - T);

    if (this.draggedPos) {
      // User has manually positioned the panel; keep clamped within visible bounds
      const clampedX = THREE.MathUtils.clamp(this.draggedPos.x, L, Math.max(L, R - cw));
      const clampedY = THREE.MathUtils.clamp(this.draggedPos.y, T - 16, Math.max(T - 16, B - minCardH));
      this.draggedPos.x = clampedX;
      this.draggedPos.y = clampedY;
      this.pos = { x: clampedX, y: clampedY };
      this.card.style.maxHeight = `${Math.max(minCardH, B - clampedY)}px`;
    } else {
      this.card.style.maxHeight = `${totalRoomH}px`;
      const ch = Math.min(this.card.offsetHeight, totalRoomH);

      if (!this.pos) {
        const roomRight = R - (ax + gap);
        const roomLeft = ax - gap - L;
        this.side = roomRight >= cw ? 1 : roomLeft >= cw ? -1 : roomRight > roomLeft ? 1 : -1;
      }
      let tx = this.side > 0 ? ax + gap : ax - gap - cw;
      // Vertically center panel gracefully relative to the 3D anchor so it uses full screen height
      let ty = THREE.MathUtils.clamp(ay - Math.round(ch * 0.35), T, Math.max(T, B - ch));
      tx = THREE.MathUtils.clamp(tx, L, Math.max(L, R - cw));
      if (w < 600) {
        tx = (w - cw) / 2;
        ty = Math.max(T, B - ch);
      }
      if (!this.pos) this.pos = { x: tx, y: ty };
      else {
        this.pos.x += (tx - this.pos.x) * 0.2;
        this.pos.y += (ty - this.pos.y) * 0.2;
      }
      this.card.style.maxHeight = `${Math.max(minCardH, B - this.pos.y)}px`;
    }

    this.card.style.left = `${this.pos.x.toFixed(1)}px`;
    this.card.style.top = `${this.pos.y.toFixed(1)}px`;

    if (behind) {
      this.setSvgVisible(false);
      return;
    }
    this.setSvgVisible(true);
    const ch = this.card.offsetHeight;
    const edgeX = ax < this.pos.x + cw / 2 ? this.pos.x : this.pos.x + cw;
    const edgeY = THREE.MathUtils.clamp(ay, this.pos.y + 24, this.pos.y + ch - 24);
    const dir = edgeX > ax ? 1 : -1;
    const elbowX = edgeX - dir * 28;
    this.path.setAttribute('d', `M${ax},${ay} L${elbowX},${edgeY} L${edgeX},${edgeY}`);
    this.dot.setAttribute('cx', ax);
    this.dot.setAttribute('cy', ay);
    this.ring.setAttribute('cx', ax);
    this.ring.setAttribute('cy', ay);
  }
}
