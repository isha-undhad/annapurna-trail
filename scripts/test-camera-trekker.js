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

async function testCameraAndTrekker() {
  console.log('Starting Chrome headless for Camera & Trekker verification...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:3000?debug=true'
  ]);

  await wait(3500);

  try {
    const targets = await fetchJson('http://127.0.0.1:9222/json/list');
    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('localhost:3000'));
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

    await new Promise((res) => (ws.onopen = res));

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    }

    // 1. Click Start Trek
    console.log('Clicking Start Trek...');
    await evaluate(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent && b.textContent.includes('Start Trek'));
      if (startBtn) startBtn.click();
    `);
    await wait(3000);

    // 2. Read initial HUD and camera mode
    const initData = await evaluate(`
      (() => {
        const hudText = document.body.innerText;
        const store = window.__TREK_DEV__ ? window.__TREK_DEV__.getMetrics() : null;
        return {
          hudSnippet: hudText.substring(0, 400),
          metrics: store,
        };
      })()
    `);
    console.log('\n--- Initial HUD State ---');
    console.log(initData.hudSnippet);

    // 3. Cycle Camera Mode using Keyboard 'V'
    console.log('\nTesting Camera Mode Cycling with key "V"...');
    for (let i = 0; i < 4; i++) {
      const modeBefore = await evaluate(`
        document.querySelector('button[title*="Switch Camera View"]')?.innerText || 'unknown'
      `);
      console.log(`Current Camera Button Text: ${modeBefore.replace(/\\n/g, ' ')}`);

      // Dispatch 'V' keydown
      await evaluate(`
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
      `);
      await wait(800);

      const modeAfter = await evaluate(`
        document.querySelector('button[title*="Switch Camera View"]')?.innerText || 'unknown'
      `);
      console.log(`After pressing V -> ${modeAfter.replace(/\\n/g, ' ')}`);
    }

    // 4. Verify Next Stop Waypoint
    const nextStopInfo = await evaluate(`
      (() => {
        const badge = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Next stop:'));
        return badge ? badge.innerText.replace(/\\n/g, ' ') : 'Next stop badge not found';
      })()
    `);
    console.log('\n--- Next Stop Route Info ---');
    console.log(nextStopInfo);

    // 5. Test fast travel / jump to Chhomrong and verify Next Stop updates to Sinuwa
    console.log('\nTeleporting to Chhomrong...');
    await evaluate(`
      if (window.__TREK_DEV__) {
        window.__TREK_DEV__.jumpTo('Chhomrong');
      }
    `);
    await wait(1500);

    const nextStopAfterJump = await evaluate(`
      (() => {
        const badge = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Next stop:'));
        return badge ? badge.innerText.replace(/\\n/g, ' ') : 'Next stop badge not found';
      })()
    `);
    console.log('After teleport to Chhomrong ->', nextStopAfterJump);

    // 6. Check console errors
    const errors = await evaluate(`window.__CONSOLE_ERRORS__ || []`);
    console.log('\nConsole Errors count:', errors.length);

    ws.close();
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    chrome.kill();
  }
}

testCameraAndTrekker();
