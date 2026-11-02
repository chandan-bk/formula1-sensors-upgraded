import * as THREE from 'three';
import { CATEGORIES } from '../data/parts.js';
import { mountSensorPreview, unmountSensorPreview } from './sensorPreview.js';
import { SENSORS, SENSOR_GROUPS, SENSOR_CATEGORIES, SENSOR_AUTHORITIES } from '../data/sensors.js';
import { explainStage } from '../data/sensorDetails.js';
import { CHANNELS, LAP_TIME } from '../data/telemetry.js';
import { LiveScope } from './liveScope.js';

const FREEDOM = ['None', 'Minimal', 'Limited', 'Substantial', 'High'];
const NS = 'http://www.w3.org/2000/svg';

/** Vertical screen span between the top and bottom toolbars. */
function freeBounds(h) {
  const top = document.getElementById('topbar')?.getBoundingClientRect().bottom ?? 0;
  const bottom = document.getElementById('bottombar')?.getBoundingClientRect().top ?? h;
  return { T: top + 12, B: bottom - 12 };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Floating info card connected to a point on a part by a leader line.
 * The anchor is stored in the part's local space so the line tracks the part
 * as it explodes, hides or as the camera orbits.
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
  }

  setSvgVisible(v) {
    for (const el of [this.path, this.dot, this.ring]) el.style.display = v ? '' : 'none';
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
      this.pos = null; // re-seat the card next to the new anchor
    }
    if (!this.visible) {
      this.card.hidden = false;
      requestAnimationFrame(() => this.card.classList.add('show'));
      this.visible = true;
      this.pos = null;
    }
    this.card.classList.toggle('pinned', pinned);
    this.setSvgVisible(true);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.infoId = null;
    this.part = null;
    this.teardownSensor();
    this.card.classList.remove('show', 'pinned', 'sensor', 'sensor-compact');
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
      <div class="cat-row">
        <span class="cat"><i style="background:${cat.color}"></i>${esc(cat.label)}</span>
        ${pinned ? '<button class="close" aria-label="Close"></button>' : '<span class="pin">Click to pin</span>'}
      </div>
      <h3>${esc(info.name)}</h3>
      <p>${esc(info.summary)}</p>
      <p><b>Who makes it:</b> ${esc(cat.who)}</p>
      <div class="freedom">Team design freedom <div class="bars">${bars}</div><em>${FREEDOM[info.freedom]}</em></div>
      <ul>${info.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      ${info.numbers?.length ? `<p>${info.numbers.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join(' · ')}</p>` : ''}
      ${info.isNew ? `<p><b>New for 2026:</b> ${esc(info.isNew)}</p>` : ''}
    `;
    this.card.querySelector('.close')?.addEventListener('click', () => this.onClose?.());
  }

  teardownSensor() {
    unmountSensorPreview();
    this.scope = null;
    this.live = null;
  }

  /** Sensor card: a compact live preview on hover, the full explainer once pinned. */
  renderSensor(sensor, pinned) {
    const cat = SENSOR_CATEGORIES[sensor.category];
    const auth = SENSOR_AUTHORITIES[sensor.authority];
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

    const head = `
      <div class="cat-row">
        <span class="cat"><i style="background:${catColor}"></i>${esc(cat.short)}<span class="cat-sep">in</span>${esc(group?.label ?? '')}</span>
        <span class="sensor-auth-badge" style="background:${authColor}22; color:${authColor}; border:1px solid ${authColor}55;" title="${esc(auth.description)}">
          ${esc(sensor.authority === 'FIA' ? 'FIA mandatory' : 'Team')}
        </span>
        ${pinned ? '<button class="close" aria-label="Close"></button>' : ''}
      </div>
      <h3>${esc(sensor.name)}</h3>
      <p class="sensor-plain">${esc(sensor.plain)}</p>`;

    const liveBlock = `
      <div class="sensor-live">
        <div class="live-read">
          <span class="live-label">${esc(ch.label)}</span>
          <span class="live-value"><b data-live="value">–</b><em>${esc(ch.unit)}</em></span>
          <span class="live-status" data-live="status">Nominal</span>
        </div>
        <canvas class="live-scope" data-live="scope"></canvas>
      </div>`;

    if (!pinned) {
      this.card.innerHTML = `${head}${liveBlock}<p class="pin-hint">Click the sensor to pin the full explanation</p>`;
      this.attachLive(sensor, catColor, true);
      return;
    }

    const idx = SENSORS.indexOf(sensor);
    const stages = sensor.dataPath.split(/\s*->\s*/);
    const note = sensor.notes ?? [];
    const readings = Math.round((sensor.hz || 100) * LAP_TIME);
    const fmtHz = sensor.hz >= 1000 ? `${(sensor.hz / 1000).toString().replace(/\.0$/, '')} kHz` : `${sensor.hz} Hz`;

    const tabWhat = `
      <div class="tab-panel" data-panel="what">
        <p><b>Measures</b> ${esc(sensor.measures)}</p>
        <p><b>Why it matters</b> ${esc(sensor.whyItMatters)}</p>
        <div class="sensor-note read"><span>How engineers read it</span>${esc(sensor.reading)}</div>
        <div class="sensor-note fail"><span>If it fails</span>${esc(sensor.failure)}</div>
      </div>`;

    const tabHow = `
      <div class="tab-panel" data-panel="how" hidden>
        <p>${esc(sensor.principle)}</p>
        <dl class="spec-grid">
          ${sensor.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>
        <p class="spec-fine">Sampled around ${esc(fmtHz)}, roughly ${readings.toLocaleString('en-US')} readings in one ${LAP_TIME} s lap.</p>
        <p class="spec-fine"><b>${esc(cat.short)}:</b> ${esc(cat.description)}<br /><b>${esc(auth.short)}:</b> ${esc(auth.description)}</p>
      </div>`;

    const tabPath = `
      <div class="tab-panel" data-panel="path" hidden>
        <p class="spec-fine path-intro">Follow a reading from the sensor to the pit wall. The glowing line on the car shows this route (drawn schematically).</p>
        <ol class="stage-list">
          ${stages
            .map(
              (st, i) => `
            <li style="--i:${i}">
              <span class="stage-dot"></span>
              <div><b>${esc(st)}</b><p>${esc(explainStage(st, note[i]))}</p></div>
            </li>`,
            )
            .join('')}
        </ol>
      </div>`;

    this.card.innerHTML = `
      ${head}
      <div class="sensor-3d-turntable-container" id="sensor-preview-slot"></div>
      ${liveBlock}
      <div class="sensor-tabs" role="tablist">
        <button role="tab" data-tab="what">What it does</button>
        <button role="tab" data-tab="how">How it works</button>
        <button role="tab" data-tab="path">Signal path</button>
      </div>
      <div class="sensor-body">${tabWhat}${tabHow}${tabPath}</div>
      <div class="sensor-nav">
        <button data-nav="-1" aria-label="Previous sensor">‹</button>
        <span><b>${idx + 1}</b> of ${SENSORS.length} · ${esc(group?.label ?? '')}</span>
        <button data-nav="1" aria-label="Next sensor">›</button>
      </div>
    `;
    this.card.querySelector('.close')?.addEventListener('click', () => this.onClose?.());
    this.card.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => this.onNavigate?.(Number(b.dataset.nav))));
    this.card.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    this.setTab(this.tab);
    this.attachLive(sensor, catColor, false);

    const slot = this.card.querySelector('#sensor-preview-slot');
    if (slot) {
      mountSensorPreview(slot, sensor.id, {
        onFocus: () => this.onFocusSensor?.(sensor, this.part),
      });
    }
  }

  setTab(tab) {
    this.tab = tab;
    this.card.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    this.card.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    const body = this.card.querySelector('.sensor-body');
    if (body) body.scrollTop = 0;
  }

  attachLive(sensor, color, compact) {
    const q = (k) => this.card.querySelector(`[data-live="${k}"]`);
    this.live = { sensor, valueEl: q('value'), statusEl: q('status'), ch: CHANNELS[sensor.live] };
    const canvas = q('scope');
    this.scope = this.sim && canvas ? new LiveScope(canvas, this.sim, sensor.live, color, { compact }) : null;
    this._tickAt = 0;
    this.tickLive(performance.now(), true);
  }

  /** Update the live number, alarm state and scope trace. */
  tickLive(now, force = false) {
    if (!this.live || !this.sim) return;
    this.scope?.draw();
    if (!force && now - this._tickAt < 70) return;
    this._tickAt = now;
    const { valueEl, statusEl, ch, sensor } = this.live;
    const v = this.sim.state[sensor.live];
    if (valueEl) valueEl.textContent = this.sim.format(sensor.live);
    const warn = (ch.warnHi !== undefined && v > ch.warnHi) || (ch.warnLo !== undefined && v < ch.warnLo);
    if (statusEl) {
      statusEl.textContent = warn ? 'Alarm' : 'Nominal';
      statusEl.classList.toggle('warn', warn);
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
    if (this.card.classList.contains('sensor') && w >= 700) {
      // never taller than the free space between the toolbars; the tab body scrolls instead
      const fb = freeBounds(h);
      this.card.style.maxHeight = `${Math.max(240, fb.B - fb.T)}px`;
    } else this.card.style.maxHeight = '';
    const ch = this.card.offsetHeight;
    const gap = 90;
    const L = 16;
    const R = w - 16;
    const { T, B } = freeBounds(h);

    if (!this.pos) {
      // choose the side with more room
      const roomRight = R - (ax + gap);
      const roomLeft = ax - gap - L;
      this.side = roomRight >= cw ? 1 : roomLeft >= cw ? -1 : roomRight > roomLeft ? 1 : -1;
    }
    let tx = this.side > 0 ? ax + gap : ax - gap - cw;
    let ty = ay - 70;
    tx = THREE.MathUtils.clamp(tx, L, Math.max(L, R - cw));
    ty = THREE.MathUtils.clamp(ty, T, Math.max(T, B - ch));
    if (w < 600) {
      // phones: dock the card above the bottom bar
      tx = (w - cw) / 2;
      ty = Math.max(T, B - ch);
    }
    if (!this.pos) this.pos = { x: tx, y: ty };
    else {
      this.pos.x += (tx - this.pos.x) * 0.2;
      this.pos.y += (ty - this.pos.y) * 0.2;
    }
    this.card.style.left = `${this.pos.x.toFixed(1)}px`;
    this.card.style.top = `${this.pos.y.toFixed(1)}px`;

    if (behind) {
      this.setSvgVisible(false);
      return;
    }
    this.setSvgVisible(true);
    // leader: anchor -> elbow -> card edge
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
