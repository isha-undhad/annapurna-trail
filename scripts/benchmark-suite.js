const { spawn } = require('child_process');
const http = require('http');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runBenchmark(port = 3000) {
  console.log(`\n======================================================`);
  console.log(`RUNNING TREK BENCHMARK SUITE ON http://localhost:${port}`);
  console.log(`======================================================\n`);

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    `http://localhost:${port}`
  ]);

  await wait(3000);

  try {
    const targets = await fetchJson('http://127.0.0.1:9222/json/list');
    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes(`localhost:${port}`));
    if (!pageTarget) {
      console.error('Page target not found');
      return;
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await new Promise((resolve) => (ws.onopen = resolve));
    await send('Runtime.enable');
    await send('Page.enable');

    // Click "Begin Trek"
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Begin') || b.textContent.includes('Trek'));
          if (btn) btn.click();
        })()
      `,
    });

    console.log('Waiting for assets and terrain to load...');
    // Wait until draw calls > 5
    for (let i = 0; i < 20; i++) {
      await wait(1000);
      const res = await send('Runtime.evaluate', {
        expression: `window.__TREK_DEV__ ? window.__TREK_DEV__.getMetrics().drawCalls : 0`,
        returnByValue: true,
      });
      if (res && res.result && res.result.value > 5) {
        console.log(`Scene loaded after ${i + 1}s (Draw calls: ${res.result.value})`);
        break;
      }
    }

    await wait(2000);

    async function evaluateMetrics(sampleDurationMs = 1500) {
      await wait(sampleDurationMs);
      const res = await send('Runtime.evaluate', {
        expression: `JSON.stringify(window.__TREK_DEV__.getMetrics())`,
        returnByValue: true,
      });
      return JSON.parse(res.result.value);
    }

    async function setQuality(q) {
      await send('Runtime.evaluate', {
        expression: `window.__TREK_DEV__.setQuality('${q}')`,
      });
      await wait(1000);
    }

    async function jumpTo(name) {
      await send('Runtime.evaluate', {
        expression: `window.__TREK_DEV__.jumpTo('${name}')`,
      });
      await wait(1500);
    }

    async function setToggle(subsystem, state) {
      await send('Runtime.evaluate', {
        expression: `window.__TREK_DEV__.setToggle('${subsystem}', ${state})`,
      });
      await wait(800);
    }

    async function resetToggles() {
      const subsystems = ['terrain', 'mountains', 'trees', 'grass', 'rocks', 'shadows', 'postprocessing'];
      for (const s of subsystems) {
        await setToggle(s, true);
      }
      await wait(1000);
    }

    const results = {
      matrix: [],
      isolation: [],
    };

    console.log('\n--- 1. Testing Location & Quality Matrix ---');
    const locations = ['Nayapul', 'ABC'];
    const qualities = ['high', 'medium', 'low'];

    for (const loc of locations) {
      await jumpTo(loc);
      for (const q of qualities) {
        await setQuality(q);
        const m = await evaluateMetrics();
        console.log(`[${loc}] [${q.toUpperCase()}] FPS: ${m.fps} | Draw Calls: ${m.drawCalls} | Triangles: ${m.triangles.toLocaleString()} | Textures: ${m.textures}`);
        results.matrix.push({ location: loc, quality: q, fps: m.fps, drawCalls: m.drawCalls, triangles: m.triangles, textures: m.textures });
      }
    }

    console.log('\n--- 2. Isolating Subsystem Costs (at Nayapul on High Quality) ---');
    await jumpTo('Nayapul');
    await setQuality('high');
    await resetToggles();
    const baseline = await evaluateMetrics(2000);
    console.log(`[Baseline All ON] FPS: ${baseline.fps} | Draw Calls: ${baseline.drawCalls} | Triangles: ${baseline.triangles.toLocaleString()}`);
    results.isolation.push({ subsystem: 'Baseline (All ON)', fps: baseline.fps, drawCalls: baseline.drawCalls, triangles: baseline.triangles, diffFps: 0 });

    const subsystems = [
      { key: 'terrain', name: 'Without Terrain Chunks' },
      { key: 'mountains', name: 'Without Mountains' },
      { key: 'trees', name: 'Without Trees' },
      { key: 'grass', name: 'Without Grass Tufts' },
      { key: 'rocks', name: 'Without Rocks' },
      { key: 'shadows', name: 'Without Shadows' },
      { key: 'postprocessing', name: 'Without Post-Processing' },
    ];

    for (const sub of subsystems) {
      await resetToggles();
      await setToggle(sub.key, false);
      const m = await evaluateMetrics(1200);
      const diff = m.fps - baseline.fps;
      console.log(`[${sub.name}] FPS: ${m.fps} (${diff >= 0 ? '+' : ''}${diff}) | Draw Calls: ${m.drawCalls} | Triangles: ${m.triangles.toLocaleString()}`);
      results.isolation.push({ subsystem: sub.name, fps: m.fps, drawCalls: m.drawCalls, triangles: m.triangles, diffFps: diff });
    }

    await resetToggles();
    ws.close();

    console.log('\n--- BENCHMARK RESULTS SUMMARY (JSON) ---');
    console.log(JSON.stringify(results, null, 2));
    return results;
  } catch (err) {
    console.error('Benchmark suite error:', err);
  } finally {
    chrome.kill();
  }
}

runBenchmark(process.argv[2] ? parseInt(process.argv[2], 10) : 3000);
