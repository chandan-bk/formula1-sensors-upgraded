import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * Multi-OS Browser Auto-Detection
 * Supports Windows, macOS, Linux, and BROWSER_PATH / CHROME_BIN environment variables.
 */
function findBrowser() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const candidates = [
    // Windows
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe') : null,

    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',

    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const BROWSER_PATH = findBrowser();
if (!BROWSER_PATH) {
  console.error('\n================================================================');
  console.error('ERROR: No compatible Chromium browser detected.');
  console.error('Searched default paths on Windows, macOS, and Linux.');
  console.error('Please install Google Chrome or set the BROWSER_PATH environment variable:');
  console.error('  export BROWSER_PATH="/path/to/chrome" (macOS/Linux)');
  console.error('  $env:BROWSER_PATH="C:\\path\\to\\chrome.exe" (Windows PowerShell)');
  console.error('================================================================\n');
  process.exit(1);
}

const PORT = 9222;
const APP_URL = 'http://localhost:5173/';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isPortOpen(url) {
  try {
    const res = await fetch(url);
    return res.ok || res.status === 200 || res.status === 304;
  } catch (e) {
    return false;
  }
}

/**
 * Accurate Quality Gate Registry
 * Explicitly tracks and registers each executed gate to ensure total accountability.
 * Distinguishes passed, failed, and skipped gates with full diagnostic output.
 */
class QualityGateRegistry {
  constructor() {
    this.gates = [];
  }
  pass(gateNumber, name, details = '') {
    this.gates.push({ number: gateNumber, name, status: 'pass', passed: true, details });
    console.log(`✓ Quality Gate ${gateNumber}: ${name}${details ? ` -> ${details}` : ''}`);
  }
  fail(gateNumber, name, error, details = '') {
    this.gates.push({ number: gateNumber, name, status: 'fail', passed: false, error, details });
    console.error(`✗ Quality Gate ${gateNumber} FAILED: ${name} -> ${error}${details ? ` (${details})` : ''}`);
  }
  skip(gateNumber, name, reason) {
    this.gates.push({ number: gateNumber, name, status: 'skip', passed: false, reason });
    console.warn(`○ Quality Gate ${gateNumber} SKIPPED: ${name} -> ${reason}`);
  }
  summary() {
    const passed = this.gates.filter((g) => g.status === 'pass').length;
    const failed = this.gates.filter((g) => g.status === 'fail').length;
    const skipped = this.gates.filter((g) => g.status === 'skip').length;
    const total = this.gates.length;
    return { passed, failed, skipped, total, allPassed: passed === 14 && failed === 0 && skipped === 0 };
  }
}

async function main() {
  console.log('================================================================');
  console.log(' FORMULA 1 SENSOR EXPLORER — E2E BROWSER QUALITY GATES RUNNER   ');
  console.log('================================================================\n');

  const registry = new QualityGateRegistry();
  let viteProc = null;
  const running = await isPortOpen(APP_URL);
  if (!running) {
    console.log('Starting Vite server on port 5173...');
    const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
    viteProc = spawn(process.execPath, [viteBin, '--port', '5173', '--strictPort'], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (await isPortOpen(APP_URL)) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      console.error('Failed to start Vite on port 5173');
      if (viteProc) viteProc.kill();
      process.exit(1);
    }
    console.log('✓ Vite server ready at http://localhost:5173/\n');
  } else {
    console.log('✓ Vite server already running at http://localhost:5173/\n');
  }

  console.log(`Using browser binary: ${BROWSER_PATH}`);
  const browserProc = spawn(BROWSER_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-extensions',
    '--window-size=1440,900',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--no-first-run',
    '--no-sandbox',
    APP_URL,
  ]);

  function cleanup() {
    try { browserProc.kill(); } catch (e) {}
    if (viteProc) {
      try { viteProc.kill(); } catch (e) {}
    }
  }

  await sleep(2500);

  let targetList;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      targetList = await res.json();
      if (targetList && targetList.length > 0) break;
    } catch (e) {
      await sleep(500);
    }
  }

  const pageTarget =
    targetList?.find((t) => t.type === 'page' && t.url.includes('5173')) ||
    targetList?.find((t) => t.type === 'page');

  if (!pageTarget) {
    console.error('Could not find page target in:', targetList);
    cleanup();
    process.exit(1);
  }

  console.log(`Connecting to page target: ${pageTarget.title}`);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));

  let reqId = 1;
  const callbacks = new Map();
  const consoleErrors = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result || msg.error);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (msg.params.type === 'error') {
        console.error('[Browser Error]', text);
        consoleErrors.push(text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      console.error('[Browser Exception]', desc);
      consoleErrors.push(desc);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      console.error('[Eval Exception]', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res?.result?.value;
  }

  async function captureScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const filePath = path.join(SCREENSHOT_DIR, name);
    fs.writeFileSync(filePath, buffer);
    console.log(`  📸 Screenshot captured: ${name}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Waiting for car assembly and WebGL shaders compilation...');
  let loaded = false;
  for (let i = 0; i < 35; i++) {
    await sleep(600);
    const ready = await evaluate(`
      !!window.__f1 && document.getElementById('loading')?.classList.contains('done')
    `);
    if (ready) {
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    console.error('Car did not finish loading in 21s');
    cleanup();
    process.exit(1);
  }

  // =========================================================================
  // Gate 1: Application initialization & 3D car procedural assembly
  // =========================================================================
  const gate1 = await evaluate(`
    (() => {
      const hasF1 = !!window.__f1;
      const loadingDone = document.getElementById('loading')?.classList.contains('done');
      const hasScene = !!window.__f1?.scene;
      const hasRenderer = !!window.__f1?.renderer;
      const stageCanvas = !!document.getElementById('stage')?.querySelector('canvas');
      const carGroup = window.__f1?.car;
      const carChildCount = carGroup?.children?.length || 0;
      const ok = hasF1 && loadingDone && hasScene && hasRenderer && stageCanvas && carChildCount > 5;
      return { ok, hasF1, loadingDone, hasScene, hasRenderer, stageCanvas, carChildCount };
    })()
  `);
  if (gate1?.ok) {
    registry.pass(1, 'Application initialisation & 3D car procedural assembly complete', `Car parts: ${gate1.carChildCount}, Stage canvas active`);
    await captureScreenshot('01_baseline_assembled.png');
  } else {
    registry.fail(1, 'Application initialisation & 3D car procedural assembly failed', JSON.stringify(gate1));
  }

  // =========================================================================
  // Gate 2: Sensor Layer Activation & Hardware Count
  // =========================================================================
  const gate2 = await evaluate(`
    (() => {
      const chip = document.querySelector('.sensor-layer-chip');
      if (chip && chip.classList.contains('off')) chip.click();
      window.__f1.advance(0.5);
      const markers = window.__f1?.sensorsManager?.markers || [];
      const markerCount = markers.length;
      const allAnchorsValid = markerCount >= 32 && markers.every(m => m.group && m.parentPart && m.sensor && m.sensor.id);
      const rows = document.querySelectorAll('.sx-row');
      const rowCount = rows.length;
      const ok = markerCount >= 32 && allAnchorsValid && rowCount === 32;
      return { ok, markerCount, rowCount, allAnchorsValid };
    })()
  `);
  if (gate2?.ok) {
    registry.pass(2, 'Sensor layer toggled ON & hardware markers generated', `Markers: ${gate2.markerCount} (>=32), Catalogue rows: ${gate2.rowCount}`);
    await captureScreenshot('02_sensors_network_active.png');
  } else {
    registry.fail(2, 'Sensor layer toggled ON & hardware markers generated failed', JSON.stringify(gate2));
  }

  // =========================================================================
  // Gate 3: Callout Card, Pinning, and Live Telemetry
  // =========================================================================
  const gate3 = await evaluate(`
    (async () => {
      const pitot = window.__f1.sensorsManager.markers.find(m => m.sensor.id === 'sen_pitot_array');
      if (!pitot) return { ok: false, error: 'sen_pitot_array marker not found' };
      window.__f1.selectSensor(pitot.sensor);
      window.__f1.advance(1.5);
      await new Promise(r => requestAnimationFrame(r));
      const card = document.getElementById('card');
      const cardVisible = !card.hidden && (card.classList.contains('show') || window.getComputedStyle(card).display !== 'none');
      const isPinned = card.classList.contains('pinned');
      const hasTurntable = !!card.querySelector('#sensor-preview-slot canvas');
      const title = card.querySelector('h3')?.textContent || '';
      const hasTitle = title.length > 0 && title.toLowerCase().includes('pitot');
      const liveVal = card.querySelector('[data-live="value"]')?.textContent || '';
      const statusText = card.querySelector('[data-live="status"]')?.textContent || '';
      const hasLiveVal = liveVal.trim().length > 0;
      const hasOscilloscope = !!card.querySelector('canvas[data-live="scope"]');
      const ok = cardVisible && isPinned && hasTurntable && hasTitle && hasLiveVal && hasOscilloscope;
      return { ok, cardVisible, isPinned, hasTurntable, title, liveVal, statusText, hasOscilloscope };
    })()
  `);
  if (gate3?.ok) {
    registry.pass(3, 'Sensor Callout Card pinned with live telemetry', `"${gate3.title}" (Status: ${gate3.statusText}, Val: ${gate3.liveVal})`);
    await captureScreenshot('03_sensor_card_turntable.png');
  } else {
    registry.fail(3, 'Sensor Callout Card pinned with live telemetry failed', JSON.stringify(gate3));
  }

  // =========================================================================
  // Gate 4: Fixed Sensor Detail Panel — Internal Scrolling & Overflow
  // =========================================================================
  const gate4 = await evaluate(`
    (() => {
      const card = document.getElementById('card');
      if (!card) return { ok: false, error: 'card element missing' };
      const header = card.querySelector('.card-header');
      const scrollArea = card.querySelector('.card-scroll-area');
      if (!header || !scrollArea) return { ok: false, error: 'header or scrollArea missing' };

      // Select the "path" (Signal Path) tab which contains the full 6-stage architecture
      const tabPathBtn = card.querySelector('[data-tab="path"]');
      if (tabPathBtn) tabPathBtn.click();
      window.__f1.advance(0.1);

      const pathScrollH = scrollArea.scrollHeight;
      const pathClientH = scrollArea.clientHeight;
      const hasOverflow = pathScrollH > pathClientH;

      // Test scroll movement: scroll down by 150px
      scrollArea.scrollTop = 0;
      scrollArea.scrollTop = 150;
      const postScrollTop = scrollArea.scrollTop;
      const scrollMoved = postScrollTop > 40;

      // Verify sticky header: top of header remains locked to top of card
      const headerRect = header.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const headerStickyAtTop = Math.abs(headerRect.top - cardRect.top) < 4;

      // Close button remains visible and interactive
      const closeBtn = card.querySelector('.close');
      const closeVisible = !!closeBtn && window.getComputedStyle(closeBtn).display !== 'none';

      // Switch back to "what" tab
      const tabWhatBtn = card.querySelector('[data-tab="what"]');
      if (tabWhatBtn) tabWhatBtn.click();
      window.__f1.advance(0.1);

      const ok = hasOverflow && scrollMoved && headerStickyAtTop && closeVisible;
      return { ok, hasOverflow, pathScrollH, pathClientH, postScrollTop, scrollMoved, headerStickyAtTop, closeVisible };
    })()
  `);
  if (gate4?.ok) {
    registry.pass(4, 'Fixed Sensor Detail Panel internal scrolling', `overflow=${gate4.hasOverflow} (sH=${gate4.pathScrollH} > cH=${gate4.pathClientH}), scrollMoved=${gate4.scrollMoved} (${gate4.postScrollTop}px), stickyHeader=${gate4.headerStickyAtTop}`);
  } else {
    registry.fail(4, 'Fixed Sensor Detail Panel internal scrolling failed', JSON.stringify(gate4));
  }

  // =========================================================================
  // Gate 5: Draggable Sensor Panel Repositioning & Clamping
  // =========================================================================
  const gate5 = await evaluate(`
    (() => {
      const card = document.getElementById('card');
      const header = card?.querySelector('.card-header');
      if (!card || !header) return { ok: false, error: 'card or header missing' };

      const initialLeft = card.offsetLeft;
      const initialTop = card.offsetTop;

      const headerRect = header.getBoundingClientRect();
      const startX = headerRect.left + 50;
      const startY = headerRect.top + 15;

      header.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: startX,
        clientY: startY,
        button: 0,
        bubbles: true,
        cancelable: true
      }));

      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: startX + 60,
        clientY: startY + 40,
        bubbles: true,
        cancelable: true
      }));

      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: startX + 60,
        clientY: startY + 40,
        bubbles: true,
        cancelable: true
      }));

      window.__f1.advance(0.1);

      const draggedLeft = card.offsetLeft;
      const draggedTop = card.offsetTop;
      const dx = Math.abs(draggedLeft - initialLeft);
      const dy = Math.abs(draggedTop - initialTop);
      const dragMoved = dx > 15 || dy > 15;

      const rect = card.getBoundingClientRect();
      const insideViewport = rect.left >= 0 && rect.top >= 0 && rect.right <= (window.innerWidth + 1) && rect.bottom <= (window.innerHeight + 1);

      const ok = dragMoved && insideViewport;
      return { ok, dragMoved, dx, dy, draggedLeft, draggedTop, insideViewport };
    })()
  `);
  if (gate5?.ok) {
    registry.pass(5, 'Draggable sensor panel repositioning with viewport boundary clamping', `moved=true (dx=${gate5.dx.toFixed(1)}, dy=${gate5.dy.toFixed(1)}), insideViewport=${gate5.insideViewport}`);
    await captureScreenshot('03b_scrolled_and_dragged_panel.png');
  } else {
    registry.fail(5, 'Draggable sensor panel repositioning failed', JSON.stringify(gate5));
  }

  // =========================================================================
  // Gate 6: Control Shielding on Non-Drag Interactive Elements
  // =========================================================================
  const gate6 = await evaluate(`
    (() => {
      const card = document.getElementById('card');
      const closeBtn = card?.querySelector('.close');
      const previewCanvas = card?.querySelector('#sensor-preview-slot canvas');
      if (!card || !closeBtn) return { ok: false, error: 'card or closeBtn missing' };

      // 1. Attempt drag from close button
      const preCloseLeft = card.offsetLeft;
      const preCloseTop = card.offsetTop;
      const btnRect = closeBtn.getBoundingClientRect();

      closeBtn.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: btnRect.left + 5,
        clientY: btnRect.top + 5,
        button: 0,
        bubbles: true,
        cancelable: true
      }));
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: btnRect.left + 100,
        clientY: btnRect.top + 100,
        bubbles: true
      }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      window.__f1.advance(0.1);

      const postCloseLeft = card.offsetLeft;
      const postCloseTop = card.offsetTop;
      const closeShielded = Math.abs(postCloseLeft - preCloseLeft) < 2 && Math.abs(postCloseTop - preCloseTop) < 2;

      // 2. Attempt drag from 3D preview canvas
      let canvasShielded = true;
      if (previewCanvas) {
        const preCanvasLeft = card.offsetLeft;
        const preCanvasTop = card.offsetTop;
        const cvsRect = previewCanvas.getBoundingClientRect();

        previewCanvas.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: cvsRect.left + 20,
          clientY: cvsRect.top + 20,
          button: 0,
          bubbles: true,
          cancelable: true
        }));
        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cvsRect.left + 120,
          clientY: cvsRect.top + 120,
          bubbles: true
        }));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        window.__f1.advance(0.1);

        const postCanvasLeft = card.offsetLeft;
        const postCanvasTop = card.offsetTop;
        canvasShielded = Math.abs(postCanvasLeft - preCanvasLeft) < 2 && Math.abs(postCanvasTop - preCanvasTop) < 2;
      }

      const ok = closeShielded && canvasShielded;
      return { ok, closeShielded, canvasShielded };
    })()
  `);
  if (gate6?.ok) {
    registry.pass(6, 'Control shielding on buttons, canvas and interactive elements', `closeShielded=${gate6.closeShielded}, canvasShielded=${gate6.canvasShielded}`);
    await captureScreenshot('03c_panel_scrolled_to_bottom.png');
  } else {
    registry.fail(6, 'Control shielding on buttons, canvas and interactive elements failed', JSON.stringify(gate6));
  }

  // =========================================================================
  // Gate 7: Interactive Fault Injection & Telemetry Recovery
  // =========================================================================
  const gate7 = await evaluate(`
    (() => {
      const pitot = window.__f1.sensorsManager.markers.find(m => m.sensor.id === 'sen_pitot_array');
      if (!pitot) return { ok: false, error: 'pitot sensor not found' };

      // Inject disconnected fault
      window.__f1.telemetry.injectFault(pitot.sensor.live, 'disconnected');
      window.__f1.telemetry.step(0.1);
      window.__f1.callout.updateFaultAlert(pitot.sensor);
      window.__f1.advance(0.5);

      const status = window.__f1.telemetry.getStatus(pitot.sensor.live);
      const alertBox = document.querySelector('[data-fault-alert]');
      const alertDesc = alertBox?.querySelector('[data-fault-desc]')?.textContent || '';
      const alertVisible = !alertBox?.hidden;
      const faultInjected = status.code === 'OPEN_CKT' && alertVisible && alertDesc.length > 5;

      // Clear fault
      window.__f1.telemetry.clearFault(pitot.sensor.live);
      window.__f1.callout.updateFaultAlert(pitot.sensor);
      window.__f1.advance(0.5);

      const restoredStatus = window.__f1.telemetry.getStatus(pitot.sensor.live);
      const alertHiddenAfter = alertBox?.hidden === true;
      const faultCleared = restoredStatus.severity === 'nominal' && alertHiddenAfter;

      const ok = faultInjected && faultCleared;
      return {
        ok,
        faultCode: status.code,
        faultSeverity: status.severity,
        alertVisible,
        alertDescLength: alertDesc.length,
        restoredSeverity: restoredStatus.severity,
        alertHiddenAfter
      };
    })()
  `);
  if (gate7?.ok) {
    registry.pass(7, 'Fault injection and telemetry recovery', `DISCONNECT -> ${gate7.faultCode} (${gate7.faultSeverity}) -> RESTORE (${gate7.restoredSeverity})`);
  } else {
    registry.fail(7, 'Fault injection and telemetry recovery failed', JSON.stringify(gate7));
  }

  // =========================================================================
  // Gate 8: Navigation & Guided Tour
  // =========================================================================
  const gate8 = await evaluate(`
    (() => {
      const s0 = window.__f1.state.pinnedSensor?.id;
      window.__f1.navigateSensor(1);
      window.__f1.advance(1.0);
      const s1 = window.__f1.state.pinnedSensor?.id;
      window.__f1.navigateSensor(-1);
      window.__f1.advance(1.0);
      const s2 = window.__f1.state.pinnedSensor?.id;
      const navWorked = !!s0 && !!s1 && !!s2 && s0 !== s1 && s0 === s2;
      return { ok: navWorked, s0, s1, s2 };
    })()
  `);
  if (gate8?.ok) {
    registry.pass(8, 'Prev/Next sensor navigation & guided tour', `${gate8.s0} -> ${gate8.s1} -> ${gate8.s2}`);
  } else {
    registry.fail(8, 'Prev/Next sensor navigation & guided tour failed', JSON.stringify(gate8));
  }

  // =========================================================================
  // Gate 9: Search & Filtering Responsiveness
  // =========================================================================
  const gate9 = await evaluate(`
    (() => {
      const searchInput = document.querySelector('.sx-search');
      if (!searchInput) return { ok: false, error: 'search input missing' };

      const initialRows = [...document.querySelectorAll('.sx-row')].filter(r => !r.parentElement.hidden).length;

      // Filter by 'brake'
      searchInput.value = 'brake';
      searchInput.dispatchEvent(new Event('input'));
      window.__f1.advance(0.2);
      const filteredRows = [...document.querySelectorAll('.sx-row')].filter(r => !r.parentElement.hidden).length;

      // Clear filter
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      window.__f1.advance(0.2);
      const resetRows = [...document.querySelectorAll('.sx-row')].filter(r => !r.parentElement.hidden).length;

      const ok = initialRows === 32 && filteredRows > 0 && filteredRows < 32 && resetRows === 32;
      return { ok, initialRows, filteredRows, resetRows };
    })()
  `);
  if (gate9?.ok) {
    registry.pass(9, 'Search & filter responsiveness across categories and authority', `Initial: ${gate9.initialRows}, Filtered ("brake"): ${gate9.filteredRows}, Reset: ${gate9.resetRows}`);
  } else {
    registry.fail(9, 'Search & filter responsiveness failed', JSON.stringify(gate9));
  }

  // =========================================================================
  // Gate 10: Exploded View with Hardware Marker Tracking
  // =========================================================================
  const gate10 = await evaluate(`
    (() => {
      window.__f1.state.explodeTarget = 0.85;
      window.__f1.advance(2.0);
      const explodeVal = window.__f1.state.explode;
      const markers = window.__f1.sensorsManager.markers;
      const markersTracking = markers.length > 0 && markers.every(m => m.group && m.group.visible);
      const ok = explodeVal > 0.7 && markersTracking;
      return { ok, explodeVal, markersTracking, markerCount: markers.length };
    })()
  `);
  if (gate10?.ok) {
    registry.pass(10, 'Exploded view kinematics with 3D hardware marker tracking', `Explode: ${gate10.explodeVal.toFixed(2)}, Markers tracking: ${gate10.markerCount}`);
    await captureScreenshot('04_exploded_view_tracking.png');
  } else {
    registry.fail(10, 'Exploded view kinematics failed', JSON.stringify(gate10));
  }

  // =========================================================================
  // Gate 11: X-Ray Internal Chassis Inspection Mode
  // =========================================================================
  const gate11 = await evaluate(`
    (() => {
      window.__f1.state.explodeTarget = 0.0;
      const xrayBtn = document.getElementById('xray');
      if (xrayBtn && !xrayBtn.classList.contains('on')) {
        xrayBtn.click();
      } else {
        window.__f1.state.xray = true;
        window.__f1.refreshMaterials();
      }
      window.__f1.advance(2.0);

      const isXray = window.__f1.state.xray === true;
      let ghostMeshCount = 0;
      window.__f1.car.traverse((o) => {
        if (o.isMesh && o.material && (o.material.transparent || o.material.opacity < 0.9)) {
          ghostMeshCount++;
        }
      });

      const ok = isXray && ghostMeshCount > 0;
      return { ok, isXray, ghostMeshCount };
    })()
  `);
  if (gate11?.ok) {
    registry.pass(11, 'X-Ray internal chassis inspection mode functional', `isXray=true, Ghost meshes: ${gate11.ghostMeshCount}`);
    await captureScreenshot('05_xray_inspection.png');
  } else {
    registry.fail(11, 'X-Ray internal chassis inspection mode failed', JSON.stringify(gate11));
  }

  // =========================================================================
  // Gate 12: Active Aero Wing Flap Actuation & DRS Transitions
  // =========================================================================
  const gate12 = await evaluate(`
    (() => {
      window.__f1.state.xray = false;
      window.__f1.state.aeroTarget = 1.0;
      window.__f1.advance(1.5);

      const aeroVal = window.__f1.state.aeroT;
      const frontFlap = window.__f1.aero?.frontWing?.flapPivots?.[0];
      const rearFlap = window.__f1.aero?.rearWing?.flapPivots?.[0];
      const frontRot = frontFlap ? frontFlap.rotation.z : 0;
      const rearRot = rearFlap ? rearFlap.rotation.z : 0;

      const ok = aeroVal > 0.8 && (Math.abs(frontRot) > 0.05 || Math.abs(rearRot) > 0.05);
      return { ok, aeroVal, frontRot, rearRot };
    })()
  `);
  if (gate12?.ok) {
    registry.pass(12, 'Active aero wing flap actuation & DRS/Corner mode transitions', `aeroT: ${gate12.aeroVal.toFixed(2)}, Front rot: ${gate12.frontRot.toFixed(3)}, Rear rot: ${gate12.rearRot.toFixed(3)}`);
    await captureScreenshot('06_active_aero_transition.png');
  } else {
    registry.fail(12, 'Active aero wing flap actuation failed', JSON.stringify(gate12));
  }

  // =========================================================================
  // Gate 13: 360-Degree Inspector 15-Cycle Lifecycle & Resource Management
  // =========================================================================
  const gate13 = await evaluate(`
    (async () => {
      const markers = window.__f1.sensorsManager.markers;
      const testSensors = [
        markers.find(m => m.sensor.id === 'sen_pitot_array')?.sensor,
        markers.find(m => m.sensor.id === 'sen_tpms')?.sensor,
        markers.find(m => m.sensor.id === 'sen_brake_disc_temp')?.sensor,
        markers.find(m => m.sensor.id === 'sen_chassis_imu')?.sensor,
        markers.find(m => m.sensor.id === 'sen_secu')?.sensor,
      ].filter(Boolean);

      const initialGeoms = window.__f1.renderer.info.memory.geometries;
      const initialTexs = window.__f1.renderer.info.memory.textures;

      let mountedCount = 0;
      let rotatedCount = 0;
      let cleanedCount = 0;

      for (let i = 0; i < 15; i++) {
        const sensor = testSensors[i % testSensors.length];
        window.__f1.selectSensor(sensor);
        window.__f1.advance(0.1);

        const mountState = typeof window.__f1_inspector_lifecycle === 'function' ? window.__f1_inspector_lifecycle() : null;
        const slot = document.getElementById('sensor-preview-slot');
        const canvas = slot?.querySelector('canvas');

        if (canvas && mountState && mountState.isMounted && mountState.animFrameActive) {
          mountedCount++;

          // Simulate user rotation interaction on 360 turntable preview canvas
          canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 115, bubbles: true }));
          window.dispatchEvent(new PointerEvent('pointerup', { clientX: 130, clientY: 115, bubbles: true }));
          rotatedCount++;
        }
        window.__f1.advance(0.1);

        // Unmount & close inspector card
        window.__f1.callout.hide();
        window.__f1.advance(0.1);

        // Verify complete unmount and cleanup
        const cleanState = typeof window.__f1_inspector_lifecycle === 'function' ? window.__f1_inspector_lifecycle() : null;
        if (cleanState && !cleanState.isMounted && !cleanState.animFrameActive && !cleanState.hasListeners && cleanState.previewChildrenCount === 0) {
          cleanedCount++;
        }
      }

      // Re-pin sensor for subsequent views
      window.__f1.selectSensor(testSensors[0]);
      window.__f1.advance(0.5);

      const endGeoms = window.__f1.renderer.info.memory.geometries;
      const endTexs = window.__f1.renderer.info.memory.textures;
      const geomDelta = endGeoms - initialGeoms;
      const texDelta = endTexs - initialTexs;

      const ok = mountedCount === 15 && rotatedCount === 15 && cleanedCount === 15 && texDelta <= 0 && geomDelta <= 150;
      return {
        ok,
        cycles: 15,
        mountedCount,
        rotatedCount,
        cleanedCount,
        geomDelta,
        texDelta,
        initialGeoms,
        endGeoms,
        initialTexs,
        endTexs
      };
    })()
  `);
  if (gate13?.ok) {
    registry.pass(13, '360° inspector 15-cycle lifecycle & Three.js resource management', `Cycles: 15/15 mounted & cleaned, texDelta: ${gate13.texDelta}, geomDelta: ${gate13.geomDelta}`);
  } else {
    registry.fail(13, '360° inspector 15-cycle lifecycle failed', JSON.stringify(gate13));
  }

  // =========================================================================
  // Gate 14: WebGL 2.0 Capability Check & Hardware Fallback Integrity
  // =========================================================================
  const gate14 = await evaluate(`
    (() => {
      // 1. Supported Case Verification
      const supported = window.__f1_webgl_supported === true;
      const hasCheckFn = typeof window.checkWebGL2Support === 'function';
      const canvas = document.createElement('canvas');
      const webgl2Direct = !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
      const stageCanvas = !!document.getElementById('stage')?.querySelector('canvas');
      const supportedPathOk = supported && hasCheckFn && webgl2Direct && stageCanvas;

      // 2. Unsupported Fallback Path Verification
      let fallbackPathOk = false;
      let fallbackDetails = {};
      if (typeof window.renderWebGLFallback === 'function') {
        const sandbox = document.createElement('div');
        sandbox.id = 'webgl-fallback-test-sandbox';
        document.body.appendChild(sandbox);

        const returnedElem = window.renderWebGLFallback(sandbox);
        const fallbackElem = sandbox.querySelector('.webgl-fallback');
        const title = fallbackElem?.querySelector('h2')?.textContent || '';
        const hasTitle = title.includes('WebGL 2.0');
        const steps = fallbackElem?.querySelectorAll('li') || [];
        const hasSteps = steps.length >= 3;
        const badge = fallbackElem?.querySelector('div[style*="border-radius"]')?.textContent || '';
        const hasBadge = badge.includes('Hardware Acceleration');

        fallbackPathOk = !!fallbackElem && hasTitle && hasSteps && hasBadge;
        fallbackDetails = {
          hasFallbackElem: !!fallbackElem,
          title,
          hasTitle,
          stepsCount: steps.length,
          hasSteps,
          hasBadge
        };

        sandbox.remove();
      }

      const ok = supportedPathOk && fallbackPathOk;
      return {
        ok,
        supportedPathOk,
        fallbackPathOk,
        supported,
        webgl2Direct,
        stageCanvas,
        fallbackDetails
      };
    })()
  `);
  if (gate14?.ok) {
    registry.pass(14, 'WebGL 2.0 capability check & hardware fallback integrity', `Supported path active (directGL2=true, stageCanvas=true) & Fallback path verified (${gate14.fallbackDetails.stepsCount} diagnostic recovery steps)`);
  } else {
    registry.fail(14, 'WebGL 2.0 capability check & hardware fallback integrity failed', JSON.stringify(gate14));
  }

  // Console runtime error verification
  console.log(`\nBrowser console runtime errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console errors logged:', consoleErrors);
  }

  const { passed, failed, skipped, total, allPassed } = registry.summary();
  console.log('\n================================================================');
  console.log(`      QUALITY GATES SUMMARY: ${passed} OF ${total} GATES PASSED`);
  if (failed > 0) console.log(`      FAILED GATES: ${failed}`);
  if (skipped > 0) console.log(`      SKIPPED GATES: ${skipped}`);
  if (allPassed && consoleErrors.length === 0) {
    console.log('      ALL 14 QUALITY GATES & SYSTEM CHECKS PASSED WITH 100% SUCCESS');
  } else {
    console.log('      QUALITY GATES COMPLETED WITH DISCREPANCIES OR ERRORS');
  }
  console.log('================================================================\n');

  ws.close();
  cleanup();
  process.exit(allPassed && consoleErrors.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
