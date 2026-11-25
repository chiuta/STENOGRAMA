'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const X = require('./harness');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sten-'));
const ff = args => cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { cwd: tmp });
const f32 = name => new Float32Array(new Uint8Array(fs.readFileSync(path.join(tmp, name))).buffer);
// semnal „asemănător vorbirii”: sinusuri modulate + zgomot
const SIG = 'aevalsrc=0.3*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*3*t))+0.1*sin(2*PI*1800*t)*sin(2*PI*5*t)+0.02*random(0):s=44100:d=';
const dur = f => parseFloat(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmp, f)]).toString());

test('i18n: aceleași chei și marcaje în toate limbile', () => {
  const ks = Object.keys(X.I18N.ro);
  assert.deepEqual(Object.keys(X.I18N).sort(), ['de', 'en', 'es', 'fr', 'hu', 'it', 'ro']);
  for (const l in X.I18N) {
    assert.deepEqual(Object.keys(X.I18N[l]).sort(), [...ks].sort(), l);
    for (const k of ks) assert.equal((X.I18N.ro[k].match(/\{\d\}/g) || []).sort().join(), (X.I18N[l][k].match(/\{\d\}/g) || []).sort().join(), l + ':' + k);
  }
});

test('MP3: indexare, durată și felii decodabile', async () => {
  ff(['-f', 'lavfi', '-i', SIG + '200', '-ac', '1', '-b:a', '96k', 'a.mp3']);
  const f = new File([fs.readFileSync(path.join(tmp, 'a.mp3'))], 'a.mp3');
  const ix = await X.mp3Index(f);
  assert.ok(ix && Math.abs(ix.duration - 200) < 0.3, 'durată ' + (ix && ix.duration));
  let tot = 0;
  for (let t0 = 0; t0 < ix.duration; t0 += 60) {
    const i0 = Math.floor(t0 * ix.sr / ix.spf), i1 = Math.min(ix.frames, Math.ceil((t0 + 60) * ix.sr / ix.spf)), lead = Math.min(3, i0);
    fs.writeFileSync(path.join(tmp, 's.mp3'), Buffer.from(await f.slice(ix.offs[i0 - lead], i1 < ix.frames ? ix.offs[i1] : ix.end).arrayBuffer()));
    ff(['-i', 's.mp3', '-f', 'f32le', '-ac', '1', 's.raw']);
    tot += f32('s.raw').length / ix.sr - lead * ix.spf / ix.sr;
  }
  assert.ok(Math.abs(tot - ix.duration) < 0.3, 'suma feliilor ' + tot);
});

test('MP3: MPEG-2, tag ID3, respingerea zgomotului', async () => {
  ff(['-f', 'lavfi', '-i', SIG + '30', '-ac', '1', '-ar', '22050', '-id3v2_version', '3', '-write_id3v1', '1', '-b:a', '48k', 'm2.mp3']);
  const ix = await X.mp3Index(new File([fs.readFileSync(path.join(tmp, 'm2.mp3'))], 'm2.mp3'));
  assert.equal(ix.spf, 576); assert.ok(Math.abs(ix.duration - 30) < 0.3);
  assert.equal(await X.mp3Index(new File([require('crypto').randomBytes(2e6)], 'n.mp3')), null);
});

for (const [codec, ar, ac, min] of [['pcm_s16le', 16000, 1, .999], ['pcm_s16le', 44100, 2, .98], ['pcm_s24le', 48000, 1, .98], ['pcm_f32le', 22050, 2, .97], ['pcm_s32le', 16000, 1, .999]]) {
  test(`WAV ${codec} ${ar} Hz ${ac}ch`, async () => {
    ff(['-f', 'lavfi', '-i', SIG + '20', '-c:a', codec, '-ar', String(ar), '-ac', String(ac), 'w.wav']);
    const wf = new File([fs.readFileSync(path.join(tmp, 'w.wav'))], 'w.wav'), w = await X.wavInfo(wf);
    assert.ok(w && Math.abs(w.duration - 20) < 0.05);
    const a = X.wavDecode(await wf.slice(w.dataStart, w.dataStart + Math.floor(5 * w.sr) * w.fs).arrayBuffer(), w);
    ff(['-i', 'w.wav', '-t', '5', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'r.raw']);
    const r = f32('r.raw'), n = Math.min(a.length, r.length);
    assert.ok(Math.abs(a.length - r.length) <= 8);
    let ab = 0, aa = 0, rr = 0; for (let i = 0; i < n; i++) { ab += a[i] * r[i]; aa += a[i] * a[i]; rr += r[i] * r[i]; }
    assert.ok(ab / Math.sqrt(aa * rr) > min, 'corelație ' + ab / Math.sqrt(aa * rr));
  });
}

test('pickCut alege pauza', () => {
  const SR = X.SR, au = new Float32Array(50 * SR).map(() => Math.random() * 0.2 - 0.1);
  for (let i = Math.floor(31.2 * SR); i < Math.floor(31.7 * SR); i++) au[i] = 0;
  const c = X.pickCut(au, 30 * SR);
  assert.ok(c / SR > 31.2 && c / SR < 31.7);
});

test('cleanSegs: frazele-fantomă, buclele și segmentele goale', () => {
  const c = X.cleanSegs([{ s: 0, e: 1, t: 'Da.' }, { s: 1, e: 2, t: 'da' }, { s: 2, e: 3, t: 'DA!' }, { s: 3, e: 4, t: 'Da' }, { s: 4, e: 5, t: 'Mulțumesc pentru vizionare!' }, { s: 5, e: 6, t: '  ' }, { s: 6, e: 7, t: 'Altceva' }], true);
  assert.equal(c.segs.length, 3); assert.equal(c.dropped, 4);
  assert.equal(X.cleanSegs([{ s: 0, e: 1, t: 'Da.' }, { s: 1, e: 2, t: 'Da.' }, { s: 2, e: 3, t: 'Da.' }], false).segs.length, 3);
});

test('chunksToSegs: decalaj și sfârșit lipsă', () => {
  const k = X.chunksToSegs([{ text: ' a', timestamp: [0, 2] }, { text: ' b', timestamp: [2, null] }, { text: ' c', timestamp: [5, 6] }], 100, 110);
  assert.deepEqual(JSON.parse(JSON.stringify(k.map(g => [g.s, g.e, g.t]))), [[100, 102, 'a'], [102, 105, 'b'], [105, 106, 'c']]);
});

test('exporturi: SRT, VTT, TXT, DOCX valid', async () => {
  const segs = [{ s: 0, e: 3.2, t: 'Bună ziua & <bine> ați venit.' }, { s: 3.2, e: 6, t: 'Astăzi vorbim.' }, { s: 12, e: 15.5, t: 'Alt paragraf.' }];
  assert.match(X.buildSrt(segs), /^1\n00:00:00,000 --> 00:00:03,200\nBună ziua/);
  assert.match(X.buildVtt(segs), /^WEBVTT\n\n00:00:00\.000 --> 00:00:03\.200/);
  assert.equal(X.buildTxt(segs, false).split('\n\n').length, 2);
  assert.equal(X.fmtSrt(3661.5), '01:01:01,500'); assert.equal(X.fmtT(3725), '01:02:05');
  const b = X.buildDocx(segs, 'Test ș ț', true); fs.writeFileSync(path.join(tmp, 'o.docx'), Buffer.from(await b.arrayBuffer()));
  cp.execFileSync('unzip', ['-tq', 'o.docx'], { cwd: tmp });
  const xml = cp.execFileSync('unzip', ['-p', 'o.docx', 'word/document.xml'], { cwd: tmp }).toString();
  assert.ok(xml.includes('Bună ziua &amp; &lt;bine&gt;') && xml.includes('[00:12]'));
});

test('fmtDur respectă limba', () => { assert.match(X.fmtDur(3725), /^1 h 02 min$/); });
