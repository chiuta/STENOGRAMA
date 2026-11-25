'use strict';
/* Test cap-coadă în Chromium real, cu motorul Whisper simulat (modelele reale nu se pot descărca în CI).
   Variabilă opțională: CHROME_PATH (calea unui Chrome/Chromium deja instalat). */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const { serve } = require('./serve');
const { chromium } = require('playwright');

const MOCK = `export const env={};
export async function pipeline(task,id,opts){
  window.__loaded=[id,opts.device];
  opts.progress_callback&&opts.progress_callback({status:'progress',file:'x',loaded:5e6,total:1e7});
  return async (audio,o)=>{const d=audio.length/16000;(window.__calls=window.__calls||[]).push([+d.toFixed(1),o.language]);
    return {text:'x',chunks:[{text:' Început de felie',timestamp:[0.5,2]},{text:' Mijloc',timestamp:[d/2,d/2+2]},{text:' Mulțumesc pentru vizionare!',timestamp:[d-3,null]}]}}}
`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sten-e2e-'));
const root = path.join(__dirname, '..');
const site = path.join(tmp, 'site'); fs.mkdirSync(site);
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) fs.copyFileSync(path.join(root, f), path.join(site, f));
const sri = 'sha384-' + crypto.createHash('sha384').update(MOCK).digest('base64');
let html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
assert.match(html, /const TF_SRI='sha384-[^']+'/);
fs.writeFileSync(path.join(site, 'index.html'), html.replace(/const TF_SRI='[^']+'/, `const TF_SRI='${sri}'`));
cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'aevalsrc=0.3*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*3*t)):s=44100:d=300', '-ac', '1', '-b:a', '96k', path.join(tmp, 'clip.mp3')]);

async function status(pg, pred, tries = 240) {
  for (let i = 0; i < tries; i++) { const t = await pg.locator('#status').innerText(); if (pred(t)) return t; await new Promise(r => setTimeout(r, 500)); }
  throw new Error('timeout; ultimul status: ' + await pg.locator('#status').innerText());
}

test('PWA, limbi, transcriere pe felii, export, offline', { timeout: 240000 }, async () => {
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
  const srv = await serve(site, 0), base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext({ locale: 'ro-RO', acceptDownloads: true });
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, body: MOCK, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' } }));
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(base);
    assert.equal(await pg.locator('#h1a').innerText(), '1. Fișier audio');
    // PWA: SW + manifest + offline
    await pg.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
    await pg.waitForFunction(() => caches.open('stenograma-v1').then(c => c.match('./index.html')).then(r => !!r), null, { timeout: 20000 });
    await pg.reload();
    assert.ok(await pg.evaluate(() => !!navigator.serviceWorker.controller), 'SW controlează pagina');
    await ctx.setOffline(true); await pg.reload();
    assert.equal(await pg.locator('#h1a').innerText(), '1. Fișier audio', 'merge offline');
    await ctx.setOffline(false);
    // limbi
    for (const [l, exp] of [['en', '1. Audio file'], ['fr', '1. Fichier audio'], ['de', '1. Audiodatei'], ['es', '1. Archivo de audio'], ['it', '1. File audio'], ['hu', '1. Hangfájl'], ['ro', '1. Fișier audio']]) {
      await pg.selectOption('#ui', l); assert.equal(await pg.locator('#h1a').innerText(), exp);
    }
    // transcriere pe felii
    await pg.setInputFiles('#file', path.join(tmp, 'clip.mp3')); await pg.click('#go');
    const st = await status(pg, t => t.startsWith('Gata:') || t.startsWith('Eroare'));
    assert.match(st, /^Gata: \d+ segmente/, st);
    const calls = await pg.evaluate(() => window.__calls);
    assert.ok(calls.length >= 2 && calls.every(c => c[1] === 'romanian'), JSON.stringify(calls));
    assert.ok(Math.abs(calls.reduce((a, c) => a + c[0], 0) - 300) < 3, 'feliile acoperă tot fișierul');
    assert.ok(await pg.locator('.seg').count() >= 4);
    // exporturi
    for (const [id, ext] of [['#dsrt', '.srt'], ['#ddocx', '.docx'], ['#dtxt', '.txt'], ['#dvtt', '.vtt']]) {
      const [d] = await Promise.all([pg.waitForEvent('download'), pg.click(id)]);
      assert.ok(d.suggestedFilename().endsWith(ext)); const p = await d.path(); assert.ok(fs.statSync(p).size > 50);
    }
    assert.deepEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
