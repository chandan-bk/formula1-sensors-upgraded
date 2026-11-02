import { CHANNELS } from '../data/telemetry.js';

/**
 * A small oscilloscope that draws the last ~12 s of one simulated telemetry channel.
 * Reference lines are drawn for the channel's limits so a reading can be judged at a glance:
 *   amber dashed = warning limit, green band = ideal operating window, white dotted = legal limit.
 */
export class LiveScope {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {ReturnType<import('../data/telemetry.js').createTelemetry>} sim
   * @param {string} channel key in CHANNELS
   * @param {string} color trace colour (CSS)
   * @param {{compact?: boolean}} [opts]
   */
  constructor(canvas, sim, channel, color, { compact = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = sim;
    this.ch = channel;
    this.def = CHANNELS[channel];
    this.color = color;
    this.compact = compact;
    this.buf = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 80;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
  }

  draw() {
    const { ctx, dpr, w, h, def } = this;
    if (!def) return;
    if (this.canvas.clientWidth && Math.abs(this.canvas.clientWidth - w) > 1) this.resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const padT = this.compact ? 3 : 6;
    const padB = this.compact ? 3 : 6;
    const padR = this.compact ? 4 : 6;
    const H = this.h - padT - padB;
    const W = this.w - padR;
    const span = def.max - def.min;
    const yOf = (v) => padT + H - ((v - def.min) / span) * H;

    // grid
    if (!this.compact) {
      ctx.strokeStyle = 'rgba(255,250,245,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const y = Math.round(padT + (H * i) / 4) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      for (let i = 1; i < 4; i++) {
        const x = Math.round((W * i) / 4) + 0.5;
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + H);
      }
      ctx.stroke();
    }

    // ideal window
    if (def.bandLo !== undefined && def.bandHi !== undefined) {
      ctx.fillStyle = 'rgba(0,230,118,0.08)';
      ctx.fillRect(0, yOf(def.bandHi), W, yOf(def.bandLo) - yOf(def.bandHi));
    }
    // limit lines
    const line = (v, col, dash) => {
      if (v === undefined) return;
      const y = Math.round(yOf(v)) + 0.5;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    line(def.warnHi, 'rgba(255,171,64,0.55)', [4, 3]);
    line(def.warnLo, 'rgba(255,171,64,0.55)', [4, 3]);
    line(def.limit, 'rgba(255,255,255,0.45)', [1, 3]);
    if (def.min < 0 && def.max > 0) line(0, 'rgba(255,250,245,0.14)', []);

    // trace
    this.buf = this.sim.series(this.ch, this.buf);
    const n = this.buf.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W;
      const y = yOf(Math.min(def.max, Math.max(def.min, this.buf[i])));
      if (i === 0) ctx.moveTo(x, y);
      else if (def.text) {
        ctx.lineTo(x, yOf(Math.min(def.max, Math.max(def.min, this.buf[i - 1]))));
        ctx.lineTo(x, y);
      } else ctx.lineTo(x, y);
    }
    // soft fill under the trace
    const grad = ctx.createLinearGradient(0, padT, 0, padT + H);
    grad.addColorStop(0, hexA(this.color, 0.28));
    grad.addColorStop(1, hexA(this.color, 0));
    ctx.save();
    ctx.lineTo(W, padT + H);
    ctx.lineTo(0, padT + H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W;
      const y = yOf(Math.min(def.max, Math.max(def.min, this.buf[i])));
      if (i === 0) ctx.moveTo(x, y);
      else if (def.text) {
        ctx.lineTo(x, yOf(Math.min(def.max, Math.max(def.min, this.buf[i - 1]))));
        ctx.lineTo(x, y);
      } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.compact ? 1.4 : 1.7;
    ctx.lineJoin = 'round';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.compact ? 0 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // live cursor
    const last = this.buf[n - 1];
    const cy = yOf(Math.min(def.max, Math.max(def.min, last)));
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(W, cy, this.compact ? 2.5 : 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexA(this.color, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W, cy, this.compact ? 5 : 7.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
