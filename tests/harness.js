'use strict';
/* Încarcă funcțiile pure din index.html într-un context vm (fără DOM). */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const ctx = { Blob, File, TextEncoder, console, Float32Array, Uint8Array, DataView, ArrayBuffer, Uint32Array, Math, Number, String, Promise, performance };
vm.createContext(ctx);
vm.runInContext(js + '\n;this.X={I18N,tr,SR,resampleMono,pickCut,mp3Index,wavInfo,wavDecode,cleanSegs,chunksToSegs,paragraphs,buildTxt,buildSrt,buildVtt,buildDocx,fmtT,fmtSrt,fmtDur,parseMp3Header,rms,normT};', ctx);
module.exports = ctx.X;
