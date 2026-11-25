# STENOGRAMA

Transcriere audio lungă, direct în browser. Un singur fișier HTML, fără cont, fără server, fără watermark. Fișierul tău audio nu pleacă din dispozitiv; doar modelul Whisper se descarcă o singură dată.

Făcut cu Claude pentru Alexio, în spiritul „fără frontiere” / trade-free.

**Aplicația live (după activarea GitHub Pages):** https://chiuta.github.io/stenograma/

## Ce face

- Transcrie fișiere audio lungi cu **Whisper local** (WebGPU când browserul îl are, altfel procesor/WASM).
- **MP3 și WAV se citesc pe bucăți**, deci durata nu e limitată de memorie. Alte formate (M4A, OGG/Opus, MP4, FLAC) se decodează întregi (recomandat până la ~90 de minute).
- Taie fiecare felie într-o **pauză**, ca să nu spargă cuvinte. Progresul se salvează în browser: poți opri și **relua** același fișier.
- Editor în pagină: apeși pe un timp ca să asculți locul, corectezi textul direct.
- Elimină frazele-fantomă tipice Whisper („Mulțumesc pentru vizionare”) și buclele de repetiții (opțional).
- Export: **.txt** (cu sau fără marcaje de timp), **.srt**, **.vtt**, **.docx**, copiere în clipboard.
- Interfață în **română, engleză, franceză, germană, spaniolă, italiană și maghiară**; limba vorbită urmează limba interfeței, dar se poate schimba.
- **PWA**: se instalează și rulează offline (aplicația și biblioteca; modelul rămâne în cache-ul browserului după prima descărcare).

## Modele

| Model | Mărime | Note |
| --- | --- | --- |
| tiny | ~40 MB | rapid, calitate slabă |
| base | ~80 MB | echilibrat |
| small | ~250 MB | recomandat |
| large-v3-turbo | ~0,8 GB | cel mai bun; doar cu WebGPU |

Pe procesor (WASM) transcrierea poate dura de câteva ori durata audio; cu WebGPU este de regulă mai rapidă decât timpul real.

## Instalare

- **Simplu:** deschide `index.html` cu dublu clic (în Chrome/Edge). Merge și așa; PWA-ul cere însă HTTPS.
- **PWA / GitHub Pages:** Settings › Pages › Deploy from a branch › `main` / `(root)`.
- **Local cu server:** `node tests/serve.js` și deschide adresa afișată.

## Limite

- Safari nu decodează Opus (formatul vocalelor WhatsApp `.opus`/`.ogg`); convertește în MP3 sau WAV.
- Fișierele care nu sunt MP3/WAV se decodează întregi în memorie; peste 600 MB aplicația cere conversia.
- Cât lucrează, ține fila deschisă și ecranul treaz (aplicația cere „wake lock” unde browserul îl oferă).
- Cuvintele rare, numele proprii și acronimele se corectează manual; Whisper greșește.

## Dependențe externe și verificare

Încărcate de pe jsDelivr, doar la prima folosire a transcrierii: `@huggingface/transformers@3.7.6` (transformers.js, Apache-2.0), cu runtime-ul ONNX. Aplicația verifică amprenta **SHA-384** a bibliotecii înainte de import; la nepotrivire se oprește. Modelele Whisper (OpenAI, MIT; conversii ONNX de pe Hugging Face) se descarcă de la Hugging Face. Politica CSP din pagină restrânge scripturile la pagină, jsDelivr și `blob:`.

## Stare

Testat automat (`npm test`, în CI pe Ubuntu 26.04 cu cel mai recent Node.js): indexarea MP3 (MPEG-1/2, ID3, respingerea zgomotului), citirea WAV în mai multe formate, alegerea punctelor de tăiere, curățarea segmentelor, exporturile (inclusiv .docx valid), cheile și marcajele tuturor limbilor, iar în Chromium real: PWA + offline, schimbarea limbii, transcrierea pe felii și exporturile.

**Netestat:** Whisper real (modelele nu s-au putut descărca în mediul de dezvoltare; testele folosesc un motor simulat), numele exacte ale modelelor ONNX și opțiunile WebGPU, Safari/iOS, viteza pe dispozitive reale. Dacă ceva nu merge, folosește butonul „Copiază detalii pentru suport”.

## Dezvoltare

```
npm install
CHROME_PATH=/usr/bin/google-chrome npm test   # CHROME_PATH e opțional dacă ai rulat `npx playwright install chromium`
```

Aplicația e în întregime în `index.html`; `sw.js` și `manifest.webmanifest` sunt doar pentru PWA.

## Licență

MIT — vezi `LICENSE`.
