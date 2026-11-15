// Synthesises the custom push-notification sounds offered in the admin
// Settings tab (see lib/notification-sounds.ts) as 16-bit mono WAVs:
//   - native/mobile/android/app/src/main/res/raw/  → bundled in the APK;
//     Android notification channels can only play sounds from res/raw
//   - public/sounds/                                 → in-browser previews
//
// Run with `npm run sounds`, then rebuild the
// APK so the new res/raw files ship with it.

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIRS = [
  join(ROOT, 'native/mobile/android/app/src/main/res/raw'),
  join(ROOT, 'public/sounds'),
];
const RATE = 44100;

// Adds one struck note to `buf`. Each partial is [frequency ratio, amplitude,
// decay time constant in seconds], so upper partials can die away faster.
function strike(buf, start, freq, partials, attack = 0.004) {
  const from = Math.floor(start * RATE);
  for (let i = from; i < buf.length; i++) {
    const t = (i - from) / RATE;
    const env = t < attack ? t / attack : 1;
    let s = 0;
    for (const [ratio, amp, tau] of partials) {
      s += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * ratio * t);
    }
    buf[i] += env * s;
  }
}

function render(seconds, draw) {
  const buf = new Float32Array(Math.floor(seconds * RATE));
  draw(buf);
  // Normalise to -1 dBFS and fade the last 50 ms so nothing clicks
  const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const fade = Math.floor(0.05 * RATE);
  for (let i = 0; i < buf.length; i++) {
    const tail = Math.min(1, (buf.length - i) / fade);
    buf[i] = (buf[i] / peak) * 0.89 * tail;
  }
  return buf;
}

function toWav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // fmt chunk size
  header.writeUInt16LE(1, 20);         // PCM
  header.writeUInt16LE(1, 22);         // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);  // byte rate
  header.writeUInt16LE(2, 32);         // block align
  header.writeUInt16LE(16, 34);        // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const GLASS   = [[1, 1, 0.55], [2, 0.22, 0.25], [3, 0.07, 0.12]];
const DOOR    = [[1, 1, 0.75], [2, 0.15, 0.35], [3, 0.05, 0.2]];
const MARIMBA = [[1, 1, 0.22], [3.93, 0.3, 0.05], [9.2, 0.08, 0.02]];
// Church-bell partials (hum, prime, tierce, quint, nominal, ...) — the
// slightly detuned prime adds a slow shimmer
const BELL = [
  [0.5, 0.35, 1.6], [1, 1, 1.2], [1.003, 0.5, 1.2], [1.19, 0.45, 0.8],
  [1.5, 0.3, 0.6], [2, 0.55, 0.5], [2.52, 0.22, 0.3], [3.01, 0.14, 0.2], [4.1, 0.07, 0.12],
];

const SOUNDS = {
  // Two soft rising glass notes (G5 → D6)
  chime: render(1.4, (b) => {
    strike(b, 0, 783.99, GLASS);
    strike(b, 0.16, 1174.66, GLASS);
  }),
  // One clear bell strike
  bell: render(2.2, (b) => strike(b, 0, 523.25, BELL, 0.002)),
  // Classic ding-dong doorbell (E5 → C5)
  doorbell: render(1.9, (b) => {
    strike(b, 0, 659.25, DOOR);
    strike(b, 0.42, 523.25, DOOR);
  }),
  // Quick rising marimba arpeggio, played twice — cuts through a busy shop
  alert: render(1.4, (b) => {
    for (const offset of [0, 0.55]) {
      [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => strike(b, offset + i * 0.075, f, MARIMBA, 0.002));
    }
  }),
};

for (const dir of OUT_DIRS) {
  mkdirSync(dir, { recursive: true });
  for (const [id, buf] of Object.entries(SOUNDS)) {
    writeFileSync(join(dir, `notify_${id}.wav`), toWav(buf));
  }
}
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds to:\n  ${OUT_DIRS.join('\n  ')}`);
