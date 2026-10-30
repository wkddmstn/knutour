// js/tour-bgm.js — 투어 배경 음악 (담당: 장주연)
// 음악 파일 없이 브라우저(WebAudio)로 잔잔한 산책 음악을 그때그때 만들어 튼다 → 저작권 걱정 없음, 용량 0
// 호반우가 말할 땐 duck(true)로 소리를 줄이고, 말이 끝나면 duck(false)로 되돌린다.
const PREF = "knu-tour-bgm";
const VOL = 0.13, DUCK = 0.025;
const BPM = 92, STEP = 60 / BPM / 2;          // 8분음표 길이(초)
// C - Am - F - G (한 마디씩). 숫자는 MIDI 음 번호
const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const BASS = [36, 33, 29, 31];
const PENTA = [72, 74, 76, 79, 81, 84];

let ctx = null, master = null, timer = 0, nextT = 0, step = 0, ducked = false, running = false;
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const isOn = () => { try { return localStorage.getItem(PREF) !== "off"; } catch { return true; } };
export function setOn(on) {
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {}
  if (on) start(); else stop();
}

function note(freq, t, dur, { type = "triangle", vol = 0.3, attack = 0.01 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % 4, s = step % 8;
    const ch = CHORDS[bar];
    if (s === 0 || s === 4) note(hz(BASS[bar]), nextT, STEP * 3.5, { type: "sine", vol: 0.5, attack: 0.02 });
    if (s === 0) ch.forEach((n) => note(hz(n), nextT, STEP * 7.5, { type: "sine", vol: 0.12, attack: 0.25 }));   // 부드러운 화음
    note(hz(ch[[0, 1, 2, 1][s % 4]] + 12), nextT, STEP * 1.6, { vol: 0.13 });                               // 통통 튀는 아르페지오
    if (s % 2 === 0 && Math.random() < 0.55) {                                                                  // 가끔 흥얼거리는 멜로디
      const pool = PENTA.filter((n) => ch.some((c) => (n - c) % 12 === 0) || Math.random() < 0.35);
      note(hz(pool[Math.floor(Math.random() * pool.length)] || 76), nextT, STEP * 2.2, { type: "sine", vol: 0.16 });
    }
    nextT += STEP;
    step++;
  }
}

export function start() {
  if (running || !isOn()) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(ducked ? DUCK : VOL, ctx.currentTime + 1.5);
    ctx.resume?.().catch(() => {});
    nextT = ctx.currentTime + 0.1;
    step = 0;
    running = true;
    timer = setInterval(schedule, 120);
    schedule();
  } catch (e) { console.warn("[투어 음악]", e); }
}
export function stop() {
  if (!running) return;
  running = false;
  clearInterval(timer);
  try {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  } catch {}
}
export function resume() { try { if (ctx?.state === "suspended") ctx.resume(); } catch {} }
// 말하는 동안 작게
export function duck(on) {
  ducked = on;
  if (!running || !master) return;
  try {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(on ? DUCK : VOL, t + (on ? 0.25 : 1.2));
  } catch {}
}
