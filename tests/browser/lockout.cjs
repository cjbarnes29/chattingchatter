// Serves a built app, mocks the Supabase backend, seeds a signed-in session with a PIN set,
// and records whether any real-app content is ever in the DOM before the PIN screen.
const { chromium } = require(process.env.PW);
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2];
const srv = http.createServer((q, r) => {
  let f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  const ext = path.extname(f);
  r.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[ext] || 'application/octet-stream');
  r.end(fs.readFileSync(f));
}).listen(0, async () => {
  const port = srv.address().port;
  const uid = '11111111-1111-4111-8111-111111111111', email = 'audit@example.test';
  // a real PBKDF2 hash of PIN 2468, same format as src/pinLock.ts
  const salt = crypto.randomBytes(16);
  const h = crypto.pbkdf2Sync('2468', salt, 210000, 32, 'sha256').toString('hex');
  const pinHash = `pbkdf2$210000$${salt.toString('base64')}$${h}`;
  const salt2 = crypto.randomBytes(16);
  const decoyHash = `pbkdf2$210000$${salt2.toString('base64')}$${crypto.pbkdf2Sync('1357', salt2, 210000, 32, 'sha256').toString('hex')}`;
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const session = { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: uid, exp })).toString('base64url') + '.y', token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id: uid, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
  const b = await chromium.launch();
  const results = [];
  for (const run of [2]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route('**/*.supabase.co/**', (route) => {
      const u = route.request().url();
      if (u.includes('/rest/v1/profiles') && route.request().method() === 'GET')
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().headers()['accept']?.includes('object') ? { name: 'Audit', avatar: null, about: '', nickname: '', age: null, status: '', presence_mode: 'auto' } : []) });
      if (u.includes('/rest/v1/')) return route.fulfill({ contentType: 'application/json', body: '[]' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await ctx.addInitScript(([s, e, ph, dh]) => {
      localStorage.setItem('sb-jirquumzasixrqwxulmg-auth-token', JSON.stringify(s));
      localStorage.setItem('chatter.pro.' + e, JSON.stringify({ realPinHash: ph, decoyPinHash: dh }));
      window.__seen = [];
      const mark = () => {
        const t = document.body ? document.body.innerText : '';
        const real = /Send and receive messages with friends|Search or start new chat|New chat/i.test(t);
        const gate = /Enter your PIN/.test(t);
        const tag = real ? 'REAL_APP' : gate ? 'PIN_GATE' : null;
        if (tag && window.__seen[window.__seen.length - 1] !== tag) window.__seen.push(tag);
      };
      new MutationObserver(mark).observe(document, { subtree: true, childList: true, characterData: true });
    }, [session, email, pinHash, decoyHash]);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${port}/`);
    await p.waitForTimeout(2500);
    await p.waitForTimeout(2500);
    const reqs = []; p.on('request', (q) => { if (q.url().includes('supabase.co/rest')) reqs.push(q.url().split('/rest/v1/')[1].split('?')[0]) });
    const type = async (pin) => { for (const d of pin) await p.click(`button[aria-label="Digit ${d}"]`); await p.click('button[aria-label="Unlock"]'); await p.waitForTimeout(400) };
    if (run === 1) {
      await type('1357'); await p.waitForTimeout(2000);
      const t = await p.evaluate(() => document.body.innerText);
      results.push({ test: 'decoy PIN', decoyChatShown: /Mum|Gym Buddy|Pharmacy/.test(t), restCallsInDecoy: [...new Set(reqs)], pageErrors: errs });
    } else {
      for (let i = 0; i < 5; i++) await type('0000');
      const t = await p.evaluate(() => document.body.innerText);
      const dis = await p.evaluate(() => [...document.querySelectorAll('button[aria-label^="Digit"]')].every((b) => b.disabled));
      const ls = await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('chatter.pro.')); const d = JSON.parse(localStorage.getItem(k)); return { failedAttempts: d.failedAttempts, waitLeftMs: d.lockedUntil - Date.now() } });
      const t0 = Date.now();
      await p.click('button[aria-label="Digit 2"]', { timeout: 2000 }).then(() => results.push({ clickAccepted: true }), () => results.push({ clickRefusedWhileDisabled: true }));
      await p.keyboard.type('2468'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
      results.push({ keyboardDuringWaitStillLocked: await p.evaluate(() => /Enter your PIN/.test(document.body.innerText)) });
      results.push({ digitsDisabled: dis, stored: ls, typingTookMs: Date.now() - t0 });
      const stillLocked = await p.evaluate(() => /Enter your PIN/.test(document.body.innerText));
      await p.waitForTimeout(31000);
      await p.keyboard.type('2468'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
      results.push({ rightPinAfterWaitUnlocks: await p.evaluate(() => !/Enter your PIN/.test(document.body.innerText)) });
      results.push({ test: '5 wrong PINs', lockoutMessage: (t.match(/Too many wrong PINs[^.]*/) || [null])[0], rightPinRefusedDuringWait: stillLocked, pageErrors: errs });
    }
    await ctx.close();
  }
  console.log(JSON.stringify(results));
  await b.close(); srv.close();
});
