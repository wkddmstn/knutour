// js/tour.js — 호반우와 캠퍼스 투어 (담당: 장주연)
// 흐름: 홈 탭 "투어" 카드 → 코스 고르기 → [이동 화면: 지도·화살표·호반우 음성 안내] → 도착 →
//       기존 구역 채팅(미션)으로 연결 → 미션 메뉴/구역 클리어에서 "다음 장소로 (투어)" → 다시 이동 화면 → … → 완주
// main.js는 이 파일을 "있으면 쓰는" 방식(동적 import + try/catch)으로 불러온다.
// 그래서 이 파일에 문제가 생겨도 기존 앱(구역 채팅·미션·AR)은 그대로 동작한다.
import * as geo from "./geo.js";
import { MASCOTS, setHobanuPaneExtra } from "./ar.js";

export const TOUR_ON = true;          // false로 바꾸면 투어 카드/버튼이 전부 사라진다
const DEMO_WALK = true;               // 시연용 "데모로 걸어가기" 버튼 (실제 운영 때는 false)
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";   // ?debug=1 : 지도를 누르면 좌표 표시
const KEY = "knu-tour-v1";
const BADGE_KEY = "knu-tour-badges";      // { courseId: 받은 시각 }
const VOICE_KEY = "knu-tour-voice";

// 출발 위치. 정문 좌표는 추정값이에요 → ?debug=1 로 지도를 눌러 정확한 좌표를 찾아 바꿔 주세요.
const GATES = {
  main: { id: "gate-main", name: "정문", lat: 35.8893, lng: 128.6157 },
  // north: { id: "gate-north", name: "북문", lat: 0, lng: 0 },   // 북문은 나중에 추가
};

const COURSES = [
  { id: "godsaeng", name: "갓생 코스", emoji: "📚", badge: "갓생 새내기", img: "img/mascot/exam.png", desc: "공부·생활에 꼭 필요한 곳만 쏙쏙",
    stops: ["loveroad", "ilcheongdam", "library", "bokji", "centralpark"] },
  { id: "healing", name: "힐링 코스", emoji: "🌸", badge: "힐링 마스터", img: "img/mascot/no-plastic.png", desc: "맛있는 학식 먹고 산책하며 쉬어 가기",
    stops: ["loveroad", "ilcheongdam", "gongstaurant", "cherryroad", "stadium"] },
  { id: "full", name: "전체 코스", emoji: "🗺️", badge: "캠퍼스 정복자", img: "img/mascot/badge-campus.png", desc: "캠퍼스 한 바퀴 완주",
    stops: ["loveroad", "centralpark", "bokji", "library", "ilcheongdam", "gongstaurant", "cherryroad", "stadium"] },
];

// 도착했을 때 호반우가 읽어 주는 장소 소개 (zones.json 소개 문구 바탕)
const INTRO = {
  loveroad: "여기는 러브로드야. 연인이 손을 잡고 정문에서 본관 방향으로 걸으면 영원한 사랑이 이루어진다는 전설이 있어. 친구랑 같이 걸어도 좋아!",
  ilcheongdam: "여기는 일청담이야. 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 밤이 되면 호롱불이 켜지고, 가끔 신천에 사는 수달도 놀러 온대!",
  library: "여기는 중앙도서관이야. 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있어.",
  bokji: "여기는 복지관이야. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 곳이 모여 있어. 개강 준비물은 여기서 챙기면 돼!",
  centralpark: "여기는 센트럴파크, 줄여서 센팍이야. 영화를 상영하는 무빔이 열리는 잔디밭이야. 돗자리 펴고 피크닉 하기 딱 좋아!",
  gongstaurant: "여기는 공식당이야. 공대생들에게 인기 있는 학식당인데, 치즈알밥이랑 육회비빔밥이 특히 맛있어. 개강 시즌엔 사람이 많으니까 일찍 와야 해!",
  cherryroad: "여기는 벚꽃길이야. 봄이 되면 벚꽃 잎이 눈처럼 흩날리는 산책로야. 여기서 찍으면 인생샷 보장!",
  stadium: "여기는 대운동장이야. 축제 무대가 열리는 곳이고, 바로 옆 백호관에는 중앙동아리방이 모여 있어. 올해 축제엔 누가 올까?",
};
// 가는 길 절반쯤에서 들려주는 이야기 (다음 장소 미리 보기)
const HALF = {
  loveroad: "지금 걷는 이 길이 백양로야. 정문에서 본관 쪽으로 쭉 이어져.",
  ilcheongdam: "일청담은 감꽃 모양 연못이야. 물가에 수달이 있나 잘 봐 봐!",
  library: "도서관 자리는 앱으로 미리 예약할 수 있어. 꼭 깔아 둬!",
  bokji: "복지관엔 서점이랑 우체국도 있어. 교재 살 때 들러 봐!",
  centralpark: "센팍에선 무빔 영화도 상영해. 날 좋은 날 꼭 와 봐!",
  gongstaurant: "공식당 메뉴는 매일 바뀌어. 인스타나 크누피아에서 볼 수 있어!",
  cherryroad: "벚꽃길은 공식당이랑 아주 가까워. 금방 도착해!",
  stadium: "작년 축제엔 지코랑 선미도 왔대. 조금만 더 가자!",
};
// 가는 길 건물 이야기 (좌표를 알게 되면 여기에 추가 → 35m 안에 들어오면 한 번 말해 줌)
// 예) { name: "본관", lat: 35.889, lng: 128.612, line: "오른쪽에 보이는 큰 건물이 본관이야!" }
const POIS = [];

/* ---------------- 앱과 연결 ---------------- */
let app = null;   // { zones(), openZone, goTab, store, ui }
export function initTour(api) {
  app = api;
  try { setHobanuPaneExtra(renderBadgeSection); } catch {}   // 도감 탭에 투어 뱃지 칸
}
const zoneById = (id) => app?.zones().find((z) => z.id === id);
// 받침에 따라 "이야/야", "으로/로" 붙이기
const hasBatchim = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
const iya = (w) => w + (hasBatchim(w) ? "이야" : "야");
const course = (id) => COURSES.find((c) => c.id === id);

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(st) { try { st ? localStorage.setItem(KEY, JSON.stringify(st)) : localStorage.removeItem(KEY); } catch {} }
export const isActive = () => TOUR_ON && !!load();
const curStopId = () => { const st = load(); return st ? course(st.course)?.stops[st.idx] : null; };
const getBadges = () => { try { return JSON.parse(localStorage.getItem(BADGE_KEY)) || {}; } catch { return {}; } };
function giveBadge(id) {
  const b = getBadges();
  if (b[id]) return false;
  b[id] = Date.now();
  try { localStorage.setItem(BADGE_KEY, JSON.stringify(b)); } catch {}
  return true;
}
const fmtDay = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
// 호반우 그림 뱃지 (받기 전에는 실루엣)
const badgeHtml = (c, on, big = false) => `<div class="tb-badge ${on ? "on" : ""} ${big ? "big" : ""}" data-c="${c.id}">
  <div class="tb-medal"><img src="${c.img}" alt="${c.badge}">${on ? "" : "<em>?</em>"}</div>
  <b>${on ? c.badge : "???"}</b><span>${on ? fmtDay(on) + " 획득" : c.name + " 완주 시"}</span></div>`;
// 도감 탭의 "투어 뱃지" 칸 (ar.js의 도감 대표 카드 아래에 붙음)
function renderBadgeSection(slot) {
  if (!TOUR_ON || !slot) return;
  injectStyle();
  const got = getBadges();
  slot.innerHTML = `<div class="dex-inline tb-section">
    <div class="dex-head"><b>🏅 투어 뱃지</b><span>${Object.keys(got).length} / ${COURSES.length}</span></div>
    <p class="dex-sub">호반우와 투어 코스를 완주하면 호반우 뱃지를 받아요!</p>
    <div class="tb-badges">${COURSES.map((c) => badgeHtml(c, got[c.id])).join("")}</div></div>`;
  slot.querySelectorAll(".tb-badge:not(.on)").forEach((el) => (el.onclick = () => {
    const c = course(el.dataset.c);
    app?.ui?.toast?.(`${c.emoji} ${c.name}를 완주하면 받을 수 있어요`);
  }));
}

/* ---------------- 음성: 녹음 파일(클로바더빙) 우선, 없으면 브라우저 내장 TTS ---------------- */
// 녹음한 대사 (audio/tour/{키}.mp3). 말풍선 글자도 녹음과 똑같이 보여 준다. 음성: 네이버 클로바더빙
const SCRIPT = {
  "start-godsaeng": "안녕! 나는 호반우야. 정문에서 출발해서 갓생 코스를 같이 돌아 보자! 첫 번째 장소는 러브로드야.",
  "start-healing": "안녕! 나는 호반우야. 정문에서 출발해서 힐링 코스를 같이 돌아 보자! 첫 번째 장소는 러브로드야.",
  "start-full": "안녕! 나는 호반우야. 정문에서 출발해서 전체 코스를 같이 돌아 보자! 첫 번째 장소는 러브로드야.",
  "next-ilcheongdam": "다음은 일청담! 밤에 호롱불이 켜지는 연못이야. 지도 따라 같이 가 보자!",
  "next-library": "다음은 중앙도서관! 전국에서 두 번째로 책이 많은 도서관이야. 같이 가 보자!",
  "next-bokji": "다음은 복지관! 학교생활에 필요한 곳이 다 모여 있어. 같이 가 보자!",
  "next-centralpark": "다음은 센트럴파크! 무빔이 열리는 잔디밭이야. 같이 가 보자!",
  "next-gongstaurant": "다음은 공식당! 공대생들이 사랑하는 학식 맛집이야. 같이 가 보자!",
  "next-cherryroad": "다음은 벚꽃길! 벚꽃이 흩날리는 산책로야. 같이 가 보자!",
  "next-stadium": "다음은 대운동장! 축제가 열리는 곳이야. 같이 가 보자!",
  "next-loveroad": "다음은 러브로드! 손잡고 걸으면 사랑이 이루어진다는 길이야. 같이 가 보자!",
  "half-loveroad": "지금 걷는 이 길이 백양로야. 정문에서 본관 쪽으로 쭉 이어져.",
  "half-ilcheongdam": "일청담은 감꽃 모양 연못이야. 물가에 수달이 있나 잘 봐 봐!",
  "half-library": "도서관 자리는 앱으로 미리 예약할 수 있어. 꼭 깔아 둬!",
  "half-bokji": "복지관엔 서점이랑 우체국도 있어. 교재 살 때 들러 봐!",
  "half-centralpark": "센팍에선 무빔 영화도 상영해. 날 좋은 날 꼭 와 봐!",
  "half-gongstaurant": "공식당 메뉴는 매일 바뀌어. 인스타나 크누피아에서 볼 수 있어!",
  "half-cherryroad": "벚꽃길은 공식당이랑 아주 가까워. 금방 도착해!",
  "half-stadium": "작년 축제엔 지코랑 선미도 왔대. 조금만 더 가자!",
  "intro-loveroad": "도착! 여기는 러브로드야. 연인이 손을 잡고 정문에서 본관 방향으로 걸으면 영원한 사랑이 이루어진다는 전설이 있어. 친구랑 같이 걸어도 좋아!",
  "intro-ilcheongdam": "도착! 여기는 일청담이야. 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 밤이 되면 호롱불이 켜지고, 가끔 신천에 사는 수달도 놀러 온대!",
  "intro-library": "도착! 여기는 중앙도서관이야. 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있어.",
  "intro-bokji": "도착! 여기는 복지관이야. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 곳이 모여 있어. 개강 준비물은 여기서 챙기면 돼!",
  "intro-centralpark": "도착! 여기는 센트럴파크, 줄여서 센팍이야. 영화를 상영하는 무빔이 열리는 잔디밭이야. 돗자리 펴고 피크닉 하기 딱 좋아!",
  "intro-gongstaurant": "도착! 여기는 공식당이야. 공대생들에게 인기 있는 학식당인데, 치즈알밥이랑 육회비빔밥이 특히 맛있어. 개강 시즌엔 사람이 많으니까 일찍 와야 해!",
  "intro-cherryroad": "도착! 여기는 벚꽃길이야. 봄이 되면 벚꽃 잎이 눈처럼 흩날리는 산책로야. 여기서 찍으면 인생샷 보장!",
  "intro-stadium": "도착! 여기는 대운동장이야. 축제 무대가 열리는 곳이고, 바로 옆 백호관에는 중앙동아리방이 모여 있어. 올해 축제엔 누가 올까?",
  "near": "거의 다 왔어! 저 앞이야!",
  "wrong": "어, 반대쪽 같아! 화살표 방향으로 가 줘!",
  "far": "아직 좀 멀어! 화살표를 따라 조금만 더 가 줘!",
  "halfway": "벌써 반이나 왔어!",
  "finish-godsaeng": "갓생 코스 완주! 갓생 새내기 뱃지를 받았어. 같이 돌아서 즐거웠어!",
  "finish-healing": "힐링 코스 완주! 힐링 마스터 뱃지를 받았어. 같이 돌아서 즐거웠어!",
  "finish-full": "전체 코스 완주! 캠퍼스 정복자 뱃지를 받았어. 같이 돌아서 즐거웠어!",
};
const AUDIO_DIR = "audio/tour/";
let voiceEl = null;   // 하나의 오디오를 돌려 쓴다 (아이폰은 처음 버튼 누를 때 한 번 풀어 줘야 함)
const getVoiceEl = () => (voiceEl = voiceEl || new Audio());
// 키에 맞는 녹음을 재생. 파일이 없거나 재생이 막히면 글자를 TTS로 읽는다
// mode: "interrupt"(지금 말 끊고 바로) / "queue"(지금 말 끝나면) / "skip"(말하는 중이면 건너뜀)
// onStart: 실제로 말을 시작할 때 부름 (말풍선 글자를 음성과 맞추려고)
let playing = false, waiting = null;
function playKey(key, fallbackText, { mode = "interrupt", onStart } = {}) {
  const text = SCRIPT[key] || fallbackText;
  if (!voiceOn()) { onStart?.(); return; }
  if (playing && mode === "skip") return;
  if (playing && mode === "queue") { waiting = { key, fallbackText, onStart }; return; }
  waiting = null;
  onStart?.();
  const done = () => { playing = false; const w = waiting; waiting = null; if (w) playKey(w.key, w.fallbackText, { onStart: w.onStart }); };
  if (!SCRIPT[key]) { speak(text, { interrupt: true }); playing = false; return; }
  try { speechSynthesis.cancel(); } catch {}
  const a = getVoiceEl();
  try { a.pause(); } catch {}
  playing = true;
  a.onended = done;
  a.onerror = () => { speak(text, { interrupt: true }); done(); };
  a.src = AUDIO_DIR + key + ".mp3";
  a.play().catch(() => { speak(text, { interrupt: true }); done(); });
}
function stopVoice() { waiting = null; playing = false; try { voiceEl?.pause(); } catch {} try { speechSynthesis.cancel(); } catch {} }
const voiceOn = () => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } };
const setVoice = (on) => { try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch {} if (!on) { try { speechSynthesis.cancel(); } catch {} try { voiceEl?.pause(); } catch {} } };
let koVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    koVoice = vs.find((v) => v.lang?.startsWith("ko") && /google|yuna|female|여/i.test(v.name)) || vs.find((v) => v.lang?.startsWith("ko")) || null;
  } catch {}
}
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch {}
const clean = (t) => String(t).replace(/<br\s*\/?>/gi, ". ").replace(/<[^>]+>/g, "")
  .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();
function speak(text, { interrupt = false } = {}) {
  if (!voiceOn() || !("speechSynthesis" in window)) return;
  const t = clean(text);
  if (!t) return;
  try {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "ko-KR"; u.rate = 1.05; u.pitch = 1.1;
    if (koVoice) u.voice = koVoice;
    speechSynthesis.speak(u);
  } catch {}
}
/* ---------------- 스타일 ---------------- */
function injectStyle() {
  if (document.getElementById("tour-style")) return;
  const s = document.createElement("style");
  s.id = "tour-style";
  s.textContent = `
  .tb-section{margin-top:14px}
  .tb-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
  .tb-badge{text-align:center;cursor:pointer}
  .tb-medal{position:relative;width:min(84px,24vw);aspect-ratio:1;margin:0 auto 6px;border-radius:50%;overflow:hidden;
    background:radial-gradient(circle at 50% 38%,#f9fafb,#e5e8eb);box-shadow:0 0 0 4px #d1d6db,0 4px 10px rgba(0,0,0,.12)}
  .tb-medal img{width:100%;height:100%;object-fit:contain;padding:10%;box-sizing:border-box;filter:brightness(0) opacity(.18)}
  .tb-medal em{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:26px;font-weight:900;color:#b0b8c1}
  .tb-badge.on .tb-medal{box-shadow:0 0 0 4px #e7b84a,0 0 0 7px #fff3cf,0 6px 14px rgba(168,100,0,.3)}
  .tb-badge.on .tb-medal img{filter:none}
  .tb-badge b{display:block;font-size:13px}
  .tb-badge span{display:block;font-size:11px;color:var(--sub,#4e5968);margin-top:2px}
  .tb-badge:not(.on) b{color:var(--mute,#8b95a1)}
  .tb-badge.big{margin:6px auto 12px;cursor:default}
  .tb-badge.big .tb-medal{width:140px;animation:tb-shine 1s ease-out}
  .tb-badge.big b{font-size:17px}
  @keyframes tb-shine{0%{transform:scale(.4) rotate(-20deg);opacity:0}60%{transform:scale(1.12) rotate(6deg);opacity:1}100%{transform:none}}
  .tour-card{background:linear-gradient(135deg,var(--primary,#d4121a),#ff6a5b);color:#fff;border-radius:20px;padding:16px 18px;margin:4px 0 14px;
    display:flex;align-items:center;gap:12px;box-shadow:0 10px 24px -12px rgba(212,18,26,.6)}
  .tour-card img{width:58px;height:58px;object-fit:contain;flex:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
  .tour-card .tc-body{flex:1;min-width:0}
  .tour-card b{display:block;font-size:17px}
  .tour-card span{display:block;font-size:12.5px;opacity:.92;margin-top:2px}
  .tour-card .tc-btns{display:flex;flex-direction:column;gap:6px}
  .tour-card button{width:auto;margin:0;border:none;border-radius:12px;padding:9px 12px;font-size:13.5px;font-weight:800;background:#fff;color:var(--primary,#d4121a);
    font-family:inherit;white-space:nowrap}
  .tour-card button.ghost{background:rgba(255,255,255,.2);color:#fff}
  #tour-sheet{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
  #tour-sheet .ts{width:min(560px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:var(--ink,#191f28);border-radius:22px 22px 0 0;
    padding:20px 18px calc(18px + env(safe-area-inset-bottom));font-family:inherit}
  #tour-sheet h3{margin:0 0 4px;font-size:19px}
  #tour-sheet .ts-sub{margin:0 0 14px;color:var(--sub,#4e5968);font-size:13px}
  #tour-sheet .ts-gates{display:flex;gap:8px;margin-bottom:14px}
  #tour-sheet .ts-gates button{width:auto;flex:1;margin:0;padding:10px;border-radius:12px;border:2px solid var(--line,#e5e8eb);background:none;color:inherit;font-weight:700;font-family:inherit}
  #tour-sheet .ts-gates button.on{border-color:var(--primary,#d4121a);color:var(--primary,#d4121a)}
  #tour-sheet .ts-gates button:disabled{opacity:.45}
  .ts-course{width:100%;margin:0 0 10px;text-align:left;border:2px solid var(--line,#e5e8eb);border-radius:16px;padding:14px;background:none;color:inherit;font-family:inherit;display:block}
  .ts-course:active{border-color:var(--primary,#d4121a)}
  .ts-course .t{display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:800}
  .ts-course .t em{font-style:normal;font-size:12.5px;font-weight:800;color:var(--primary,#d4121a);background:var(--primary-weak,#fbe7e5);padding:4px 9px;border-radius:999px}
  .ts-course .d{font-size:12.5px;color:var(--sub,#4e5968);margin:4px 0 8px}
  .ts-course .r{font-size:12.5px;line-height:1.7;color:var(--ink,#191f28)}
  .ts-close{width:100%;margin:4px 0 0;padding:12px;border:none;border-radius:12px;background:var(--line,#e5e8eb);color:inherit;font-weight:700;font-family:inherit}
  #tour-move{position:fixed;inset:0;z-index:2000;background:var(--bg,#fff);color:var(--ink,#191f28);display:flex;flex-direction:column;font-family:inherit}
  #tour-move .tm-head{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 14px 8px}
  #tour-move .tm-head b{flex:1;font-size:15px}
  #tour-move .tm-head small{display:block;font-size:12px;color:var(--sub,#4e5968);font-weight:600}
  #tour-move .tm-icon{width:auto;margin:0;border:none;background:var(--line,#e5e8eb);color:inherit;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:700;font-family:inherit}
  #tour-move .tm-steps{display:flex;gap:4px;padding:0 14px 8px}
  #tour-move .tm-steps i{flex:1;height:5px;border-radius:3px;background:var(--line,#e5e8eb)}
  #tour-move .tm-steps i.done{background:var(--primary,#d4121a)}
  #tour-move .tm-steps i.now{background:linear-gradient(90deg,var(--primary,#d4121a) var(--p,0%),var(--line,#e5e8eb) var(--p,0%))}
  #tour-map{flex:1;min-height:180px;margin:0 14px;border-radius:18px;overflow:hidden;background:#e5e8eb}
  #tour-move .tm-next{display:flex;align-items:center;gap:12px;padding:12px 16px 4px}
  #tour-move .tm-arrow{width:64px;height:64px;flex:none;border-radius:50%;background:var(--primary-weak,#fbe7e5);display:flex;align-items:center;justify-content:center}
  #tour-move .tm-arrow svg{width:40px;height:40px;transition:transform .25s ease-out}
  #tour-move .tm-dist{flex:1;min-width:0}
  #tour-move .tm-dist b{display:block;font-size:20px}
  #tour-move .tm-dist span{font-size:12.5px;color:var(--sub,#4e5968)}
  #tour-move .tm-guide{display:flex;align-items:flex-end;gap:8px;padding:6px 14px 0}
  #tour-move .tm-guide img{width:70px;height:70px;object-fit:contain;flex:none}
  #tour-move .tm-bubble{flex:1;background:var(--cream-weak,#f2f4f6);border-radius:18px 18px 18px 4px;padding:11px 14px;font-size:14.5px;line-height:1.5;margin-bottom:10px}
  #tour-move .tm-btns{display:flex;gap:8px;padding:8px 14px calc(14px + env(safe-area-inset-bottom))}
  #tour-move .tm-btns button{flex:1;width:auto;margin:0;padding:14px;border:none;border-radius:14px;font-size:15px;font-weight:800;font-family:inherit;
    background:var(--line,#e5e8eb);color:inherit}
  #tour-move .tm-btns button.primary{background:var(--primary,#d4121a);color:#fff}
  #tour-move .tm-arrive{animation:tm-pop .5s var(--ease-toss,ease-out)}
  .tour-pin{width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid var(--primary,#d4121a);display:flex;align-items:center;justify-content:center;
    font-size:18px;box-shadow:0 3px 8px rgba(0,0,0,.25)}
  .tour-tip{background:#d4121a;color:#fff;border:none;border-radius:999px;padding:3px 9px;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.25)}
  .tour-tip::before{display:none}
  .tour-tip.me{background:#2f6fed}
  .tour-from{background:#fff;color:#191f28;border:2px solid #191f28;border-radius:999px;font-size:11px;font-weight:800;text-align:center;line-height:18px}
  .tm-legend{display:flex;gap:12px;flex-wrap:wrap;padding:6px 18px 0;font-size:11.5px;color:var(--sub,#4e5968)}
  .tm-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
  .tour-me{width:18px;height:18px;border-radius:50%;background:#2f6fed;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,237,.25)}
  @keyframes tm-pop{0%{transform:scale(.9);opacity:.3}100%{transform:none;opacity:1}}
  /* PC(넓은 화면)·휴대폰 가로: 왼쪽 큰 지도 + 오른쪽 안내 */
  @media (orientation:landscape) and (max-height:520px){ #tour-move .tm-guide img{width:56px!important;height:56px!important}
    #tour-move .tm-bubble{font-size:13.5px!important;padding:8px 12px} #tour-move .tm-btns button{padding:11px} #tour-move .tm-arrow{width:52px;height:52px} }
  @media (min-width:900px), (orientation:landscape) and (max-height:520px){
    #tour-move{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,1fr);grid-template-rows:auto auto minmax(0,1fr) auto}
    #tour-move .tm-head,#tour-move .tm-steps{grid-column:1 / -1}
    #tour-map{grid-column:1;grid-row:3;margin:0 0 0 16px;min-height:0}
    #tour-move .tm-legend{grid-column:1;grid-row:4;padding:6px 16px 12px}
    #tour-move .tm-side{grid-column:2;grid-row:3 / 5;display:flex;flex-direction:column;justify-content:center;padding:0 8px 16px}
    #tour-move .tm-bubble{font-size:16px} #tour-move .tm-guide img{width:96px;height:96px} }`;
  document.head.appendChild(s);
}

/* ---------------- 홈 탭 투어 카드 ---------------- */
const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 70));   // 실제 길은 직선보다 1.3배쯤 길다고 보고, 분당 70m
function courseStats(c, gate = GATES.main) {
  let prev = gate, dist = 0;
  c.stops.forEach((id) => { const z = zoneById(id); if (z) { dist += geo.distanceM(prev, z); prev = z; } });
  return { walk: walkMin(dist), total: walkMin(dist) + c.stops.length * 4 };
}
export function renderQuestCard(container) {
  if (!TOUR_ON || !container || !app) return;
  injectStyle();
  container.querySelector(".tour-card")?.remove();
  const st = load();
  const c = st && course(st.course);
  const card = document.createElement("div");
  card.className = "tour-card";
  const curZone = c && zoneById(c.stops[st.idx]);
  const here = c && st.arrived === st.idx;        // 지금 장소에 이미 도착해 있음 (미션 중)
  const nextZone = c && zoneById(c.stops[st.idx + 1]);
  card.innerHTML = c
    ? `<img src="img/hobanu/react-hi.png" alt=""><div class="tc-body"><b>${c.emoji} ${c.name} 진행 중</b>
         <span>${Math.min(st.idx + 1, c.stops.length)} / ${c.stops.length} · ${here ? `지금: ${curZone?.name || ""}` : `다음: ${curZone?.name || ""}`}</span></div>
       <div class="tc-btns">${here
         ? `<button data-a="next">${nextZone ? "다음 장소로 →" : "🏁 완주하기"}</button><button class="ghost" data-a="zone">${curZone?.name || ""} 미션</button>`
         : `<button data-a="go">이어서 하기</button>`}<button class="ghost" data-a="stop">그만하기</button></div>`
    : `<img src="img/hobanu/react-hi.png" alt=""><div class="tc-body"><b>호반우와 캠퍼스 투어</b>
         <span>정문에서 출발해 길 안내·장소 소개·미션까지 한 번에!</span></div>
       <div class="tc-btns"><button data-a="pick">코스 고르기</button></div>`;
  container.prepend(card);
  card.querySelector('[data-a="pick"]')?.addEventListener("click", openCourseSheet);
  card.querySelector('[data-a="go"]')?.addEventListener("click", () => { unlockAudio(); openMove(); });
  card.querySelector('[data-a="next"]')?.addEventListener("click", () => { unlockAudio(); next(curZone); });
  card.querySelector('[data-a="zone"]')?.addEventListener("click", () => curZone && app.openZone(curZone));
  card.querySelector('[data-a="stop"]')?.addEventListener("click", () => {
    if (!confirm("투어를 그만할까요? (지금까지 한 미션과 XP는 그대로 남아요)")) return;
    save(null); renderQuestCard(container);
  });
}
function openCourseSheet() {
  injectStyle();
  const el = document.createElement("div");
  el.id = "tour-sheet";
  el.innerHTML = `<div class="ts">
    <h3>🐮 호반우와 캠퍼스 투어</h3>
    <p class="ts-sub">호반우가 길을 안내하고 장소를 소개해 줘요. 도착하면 그곳의 미션을 할 수 있어요.</p>
    <div class="ts-gates"><button class="on">🚩 정문에서 출발</button><button disabled>북문 (준비 중)</button></div>
    ${COURSES.map((c) => { const s = courseStats(c); return `
      <button class="ts-course" data-c="${c.id}">
        <div class="t"><span>${c.emoji} ${c.name}</span><em>약 ${s.total}분</em></div>
        <div class="d">${c.desc} · 걷기만 약 ${s.walk}분</div>
        <div class="r">정문 → ${c.stops.map((id) => zoneById(id)?.name || id).join(" → ")}</div>
      </button>`; }).join("")}
    <button class="ts-close">닫기</button>
    <p class="ts-sub" style="margin:10px 0 0;text-align:center;font-size:11px">호반우 음성: 네이버 클로바더빙</p></div>`;
  document.body.appendChild(el);
  el.onclick = (e) => { if (e.target === el) el.remove(); };
  el.querySelector(".ts-close").onclick = () => el.remove();
  el.querySelectorAll(".ts-course").forEach((b) => (b.onclick = () => {
    unlockAudio();
    save({ course: b.dataset.c, idx: 0, gate: "main", startedAt: Date.now() });
    el.remove();
    openMove(true);
  }));
}
// 아이폰은 버튼을 누른 순간에 한 번 소리를 내 줘야 그 뒤에도 음성이 나온다
function unlockAudio() {
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {}
  try {   // 녹음 재생용 오디오도 버튼 누른 순간에 한 번 재생해서 풀어 둔다 (무음)
    const a = getVoiceEl();
    a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    a.play().then(() => a.pause()).catch(() => {});
  } catch {}
  try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch {}
}

/* ---------------- 구역 채팅과 연결 (main.js가 부름) ---------------- */
// 미션 메뉴/구역 클리어 선택지에 넣을 "다음 장소로" 버튼. 투어 중이고 지금 장소가 투어 순서의 장소일 때만
export function menuItem(zone) {
  if (!isActive() || curStopId() !== zone.id) return null;
  const st = load(), c = course(st.course);
  const nextId = c.stops[st.idx + 1];
  return { label: nextId ? `🐮 다음 장소로 (투어) · ${zoneById(nextId)?.name || ""}` : "🏁 투어 완주하기", value: "__tour", ghost: false };
}
// 지금 장소를 끝내고 다음 장소로 이동 화면을 연다
export function next(zone) {
  const st = load();
  if (!st) return;
  const c = course(st.course);
  if (zone && c.stops[st.idx] === zone.id) st.idx++;
  if (st.idx >= c.stops.length) { save(null); try { app.goTab("home"); } catch {} return finish(st); }
  save(st);
  try { app.goTab("home"); } catch {}
  openMove();
}

/* ---------------- 이동 화면 ---------------- */
let mv = null;   // 지금 열린 이동 화면의 상태
function closeMove() {
  if (!mv) return;
  try { mv.stop(); } catch {}
  mv.root.remove();
  mv = null;
}
function openMove(first = false) {
  try { _openMove(first); } catch (e) {
    console.warn("[투어] 이동 화면 오류", e);
    closeMove();
    app?.ui?.toast?.("투어 화면을 여는 중 문제가 생겼어요. 구역 목록에서 계속할 수 있어요.");
  }
}
function _openMove(first) {
  closeMove();
  injectStyle();
  const st = load(), c = course(st?.course);
  if (!c) return;
  const zone = zoneById(c.stops[st.idx]);
  if (!zone) return;
  const prev = st.idx === 0 ? GATES[st.gate || "main"] : zoneById(c.stops[st.idx - 1]);
  const mascot = MASCOTS[zone.id]?.img || "img/hobanu/react-hi.png";

  const root = document.createElement("div");
  root.id = "tour-move";
  root.innerHTML = `
    <div class="tm-head">
      <b>${c.emoji} ${c.name}<small>${st.idx + 1}번째 장소 / 총 ${c.stops.length}곳</small></b>
      <button class="tm-icon" data-a="voice"></button>
      <button class="tm-icon" data-a="out">나가기</button>
    </div>
    <div class="tm-steps">${c.stops.map((_, i) => `<i class="${i < st.idx ? "done" : i === st.idx ? "now" : ""}"></i>`).join("")}</div>
    <div id="tour-map"></div>
    <div class="tm-legend"><span><i style="background:#2f6fed"></i>내 위치</span><span><i style="background:#d4121a"></i>도착 지점 (빨간 영역에 들어오면 도착)</span><span>점선: 걸어갈 길</span><span style="margin-left:auto">음성: 네이버 클로바더빙</span></div>
    <div class="tm-side">
      <div class="tm-next">
        <div class="tm-arrow"><svg viewBox="0 0 40 40"><path d="M20 3 L33 34 L20 27 L7 34 Z" fill="var(--primary,#d4121a)"/></svg></div>
        <div class="tm-dist"><b>${zone.emoji || "📍"} ${zone.name}</b><span>거리를 재는 중…</span></div>
      </div>
      <div class="tm-guide"><img src="${mascot}" alt="호반우"><div class="tm-bubble"></div></div>
      <div class="tm-btns"></div>
    </div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const bubble = (t, opt) => { $(".tm-bubble").textContent = clean(t); speak(t, opt); };
  const say = (key, fallback, mode = "interrupt") => playKey(key, fallback, { mode, onStart: () => { const b = root.querySelector(".tm-bubble"); if (b) b.textContent = clean(SCRIPT[key] || fallback); } });
  const vBtn = $('[data-a="voice"]');
  const paintVoice = () => (vBtn.textContent = voiceOn() ? "🔊 음성" : "🔇 음성");
  paintVoice();
  vBtn.onclick = () => { setVoice(!voiceOn()); paintVoice(); };
  $('[data-a="out"]').onclick = () => { stopVoice(); closeMove(); try { app.goTab("home"); } catch {} };

  // --- 지도 ---
  let map = null, routeLine = null, meMk = null;
  const L = window.L;
  if (L) {
    map = L.map("tour-map", { zoomControl: false, attributionControl: false }).setView([zone.lat, zone.lng], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, subdomains: "abc" }).addTo(map);
    // 도착 지점 = 빨간 핀(그 장소 이모지), 주황색 영역 = 이 안에 들어오면 도착으로 인정되는 구역
    if (zone.polygon?.length >= 3) L.polygon(zone.polygon.map((q) => [q.lat, q.lng]), { color: "#d4121a", weight: 2, fillOpacity: .14 }).addTo(map);
    else L.circle([zone.lat, zone.lng], { radius: zone.radius || 40, color: "#d4121a", weight: 2, fillOpacity: .12 }).addTo(map);
    L.marker([zone.lat, zone.lng], { icon: L.divIcon({ className: "", html: `<div class="tour-pin">${zone.emoji || "📍"}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 400 })
      .addTo(map).bindTooltip(`도착: ${zone.name}`, { permanent: true, direction: "top", offset: [0, -18], className: "tour-tip" });
    L.marker([prev.lat, prev.lng], { icon: L.divIcon({ className: "", html: `<div class="tour-from">출발</div>`, iconSize: [40, 22], iconAnchor: [20, 11] }) }).addTo(map);
    POIS.forEach((p) => L.circleMarker([p.lat, p.lng], { radius: 5, color: "#e8590c", weight: 2, fillOpacity: .6 }).addTo(map).bindTooltip(p.name));
    if (DEBUG) map.on("click", (e) => {
      const t = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
      navigator.clipboard?.writeText(t).catch(() => {});
      app?.ui?.toast?.(`좌표 복사: ${t}`);
    });
  } else {
    $("#tour-map").innerHTML = `<div style="padding:20px;text-align:center;color:#4e5968">지도를 불러오지 못했어요. 화살표와 거리를 보고 이동해 주세요.</div>`;
  }
  function drawRoute(pts) {
    if (!map) return;
    routeLine?.remove();
    routeLine = L.polyline(pts.map((p) => [p.lat, p.lng]), { color: "#d4121a", weight: 5, opacity: .85, lineCap: "round", dashArray: "1 10" }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [36, 36], maxZoom: 18 });
  }
  function setMe(p) {
    if (!map) return;
    if (!meMk) meMk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="tour-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 500 })
      .addTo(map).bindTooltip("나", { permanent: true, direction: "bottom", offset: [0, 10], className: "tour-tip me" });
    else meMk.setLatLng([p.lat, p.lng]);
  }
  let route = [prev, zone].map((p) => ({ lat: p.lat, lng: p.lng }));
  drawRoute(route);
  async function loadRoute(from) {
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${zone.lng},${zone.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const coords = (await res.json()).routes?.[0]?.geometry?.coordinates;
      if (coords?.length > 1 && mv?.root === root) { route = [from, ...coords.map(([lng, lat]) => ({ lat, lng })), { lat: zone.lat, lng: zone.lng }]; drawRoute(route); }
    } catch {}
  }
  const routeReady = loadRoute(prev);

  // --- 방향(나침반) ---
  let heading = null;
  const onOri = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;
    if (h != null) heading = h;
  };
  window.addEventListener("deviceorientationabsolute", onOri);
  window.addEventListener("deviceorientation", onOri);
  let lastBearing = 0;
  const arrowTimer = setInterval(() => {
    const rotDeg = heading == null ? lastBearing : lastBearing - heading;
    const svg = $(".tm-arrow svg");
    if (svg) svg.style.transform = `rotate(${rotDeg}deg)`;
  }, 200);

  // --- 화면 꺼짐 방지 ---
  let wake = null;
  try { navigator.wakeLock?.request("screen").then((w) => (wake = w)).catch(() => {}); } catch {}

  // --- 위치가 바뀔 때마다 ---
  let d0 = null, minD = Infinity, said = {}, arrived = false, lastWrong = 0, lastUi = 0;
  const poiSaid = new Set();
  function onPos(p, { sim = false } = {}) {
    if (arrived || !mv) return;
    setMe(p);
    const d = geo.distanceM(p, zone);
    lastBearing = geo.bearingDeg(p, zone);
    if (d0 == null) d0 = Math.max(d, 1);
    minD = Math.min(minD, d);
    const pct = Math.max(0, Math.min(100, 100 - (d / d0) * 100));
    root.querySelector(".tm-steps .now")?.style.setProperty("--p", pct + "%");
    if (Date.now() - lastUi > 300 || sim) {
      lastUi = Date.now();
      $(".tm-dist span").textContent = `${Math.round(d)}m 남았어 · 걸어서 약 ${walkMin(d)}분` + (heading == null ? " · 화살표는 지도 위쪽(북) 기준" : "");
    }
    // 도착 판정: 구역 안(정확도 OK)이거나 25m 이내
    // 실제로 걸을 때: 빨간 구역 안에 들어오거나 핀에서 25m 이내면 도착. 데모 걷기는 핀까지 끝까지 걸어간다
    const ev = geo.evaluate(p, zone);
    if ((!sim && ev.status === "inside") || d <= (sim ? 3 : 25)) return arrive();
    if (!said.half && d0 > 80 && d <= d0 * 0.55) { said.half = true; HALF[zone.id] ? say("half-" + zone.id, HALF[zone.id], "queue") : say("halfway", "벌써 반이나 왔어!", "queue"); return; }
    if (!said.near && d0 > 90 && d <= 60) { said.near = true; say("near", `거의 다 왔어! 저 앞이 ${iya(zone.name)}`, "skip"); return; }
    if (!sim && d > minD + 30 && Date.now() - lastWrong > 20000) { lastWrong = Date.now(); say("wrong", "어, 반대쪽 같아! 화살표 방향으로 가 줘!"); return; }
    for (const poi of POIS) {
      if (!poiSaid.has(poi.name) && geo.distanceM(p, poi) < 35) { poiSaid.add(poi.name); bubble(poi.line); return; }
    }
  }

  let demoRunning = false, demoRaf = 0;   // 데모 걷기 중에는 실제 GPS를 무시

  // --- 실제 GPS ---
  let watchId = null, gotFix = false;
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition((g) => {
      if (demoRunning) return;
      const p = { lat: g.coords.latitude, lng: g.coords.longitude, accuracy: g.coords.accuracy };
      if (p.accuracy > geo.MAX_ACCURACY) return;
      if (!gotFix) {
        gotFix = true;
        // 학교 근처(3km 이내)일 때만 내 위치에서 경로를 다시 받는다 (집에서 시연할 땐 무시)
        if (geo.distanceM(p, zone) < 3000 && geo.distanceM(p, prev) > 60) loadRoute(p);
        if (geo.distanceM(p, zone) >= 3000) { $(".tm-dist span").textContent = "학교 밖이에요. 데모로 걷기를 눌러 보세요"; return; }
      }
      if (geo.distanceM(p, zone) < 3000) onPos(p);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }

  // --- 데모: 경로를 따라 자동으로 걸어가기 ---
  async function demoWalk() {
    if (demoRunning) return;
    demoRunning = true;
    await Promise.race([routeReady, new Promise((r) => setTimeout(r, 1500))]);
    const pts = route.length > 1 ? route : [prev, zone];
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = geo.distanceM(pts[i - 1], pts[i]); seg.push(l); total += l; }
    const dur = Math.max(6000, Math.min(14000, total * 30));   // 거리에 따라 6~14초
    d0 = null; minD = Infinity;
    const t0 = performance.now();
    const step = (now) => {
      if (!mv || mv.root !== root) return;
      let k = Math.min(1, (now - t0) / dur) * total, i = 0;
      while (i < seg.length - 1 && k > seg[i]) { k -= seg[i]; i++; }
      const p = geo.lerp(pts[i], pts[i + 1], seg[i] ? Math.min(1, k / seg[i]) : 1);
      onPos({ ...p, accuracy: 5 }, { sim: true });
      if (!arrived && now - t0 < dur) demoRaf = requestAnimationFrame(step);
      else if (!arrived) { onPos({ lat: zone.lat, lng: zone.lng, accuracy: 5 }, { sim: true }); arrive(); }
    };
    demoRaf = requestAnimationFrame(step);
  }

  // --- 도착 ---
  function arrive() {
    if (arrived) return;
    arrived = true;
    demoRunning = false;
    cancelAnimationFrame(demoRaf);
    navigator.vibrate?.([120, 60, 120]);
    root.querySelector(".tm-steps .now")?.style.setProperty("--p", "100%");
    $(".tm-dist span").textContent = "도착했어요!";
    $(".tm-guide").classList.add("tm-arrive");
    say("intro-" + zone.id, `도착! ${INTRO[zone.id] || zone.name + "에 왔어!"}`, "queue");
    paintBtns();
    if (map) map.flyTo([zone.lat, zone.lng], 18, { duration: .8 });
  }
  function markArrived() { const s = load(); if (s) { s.arrived = s.idx; save(s); } }
  function goZone() {
    markArrived();
    // 투어로 도착했으니 위치 인증은 끝난 것으로 처리 → 채팅에서 바로 미션 메뉴로
    try {
      if (!app.store.isVerified(zone.id)) {
        app.store.setVerified(zone.id);
        if (app.store.grantBonus("arrive:" + zone.id, 10)) app.ui.reward(10);
      }
    } catch {}
    closeMove();
    app.openZone(zone);
  }
  function paintBtns() {
    const box = $(".tm-btns");
    box.innerHTML = arrived
      ? `<button data-a="skip">${st.idx + 1 < c.stops.length ? "다음 장소로 →" : "🏁 완주하기"}</button><button class="primary" data-a="zone">${zone.emoji || ""} ${zone.name} 미션 하러 가기</button>`
      : `${DEMO_WALK ? `<button data-a="demo">▶ 데모로 걷기</button>` : ""}<button data-a="here">도착했어요</button>`;
    box.querySelector('[data-a="zone"]')?.addEventListener("click", goZone);
    box.querySelector('[data-a="skip"]')?.addEventListener("click", () => { markArrived(); closeMove(); next(zone); });   // 미션은 건너뛰고 투어 계속
    box.querySelector('[data-a="demo"]')?.addEventListener("click", (e) => { e.currentTarget.disabled = true; demoWalk(); });
    box.querySelector('[data-a="here"]')?.addEventListener("click", () => {
      // GPS가 부정확할 때를 위한 수동 도착 (100m 안이거나 위치를 모를 때만)
      if (meMk && geo.distanceM(meMk.getLatLng(), zone) > 100) { say("far", "아직 좀 멀어! 화살표를 따라 조금만 더 가 줘!"); return; }
      arrive();
    });
  }
  paintBtns();

  mv = {
    root,
    stop() {
      demoRunning = false;
      cancelAnimationFrame(demoRaf);
      clearInterval(arrowTimer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener("deviceorientationabsolute", onOri);
      window.removeEventListener("deviceorientation", onOri);
      try { wake?.release(); } catch {}
      try { map?.remove(); } catch {}   // 음성은 끊지 않는다 (도착 소개를 들으며 미션 화면으로 넘어가도 되게)
    },
  };

  // 출발 안내
  const fromName = prev.name || "";
  if (first && zone.id === "loveroad") say("start-" + c.id, `안녕! 나는 호반우야. ${fromName}에서 출발해서 ${c.name}를 같이 돌아 보자! 첫 번째 장소는 ${iya(zone.name)}.`);
  else say("next-" + zone.id, `다음은 ${zone.name}! ${zone.desc ? zone.desc + "." : ""} 지도 따라 같이 가 보자`);
  setTimeout(() => map?.invalidateSize(), 200);
}

/* ---------------- 완주 ---------------- */
function finish(st) {
  const c = course(st?.course);
  save(null);
  if (!c) return;
  injectStyle();
  const mins = Math.max(1, Math.round((Date.now() - (st.startedAt || Date.now())) / 60000));
  const first = app.store.grantBonus("tour:" + c.id, 100);
  if (first) app.ui.reward(100);
  const newBadge = giveBadge(c.id);
  const el = document.createElement("div");
  el.id = "tour-sheet";
  el.innerHTML = `<div class="ts" style="text-align:center">
    <h3>${c.emoji} ${c.name} 완주!</h3>
    ${badgeHtml(c, getBadges()[c.id], true)}
    <p class="ts-sub" style="margin:0 0 6px;font-weight:800;color:var(--primary,#d4121a)">${newBadge ? `🏅 '${c.badge}' 뱃지를 받았어요!` : "이미 받은 뱃지예요"} · 도감 탭에서 볼 수 있어요</p>
    <p class="ts-sub">${c.stops.length}곳을 ${mins}분 동안 함께 돌았어요.${first ? " 완주 보너스 100 XP!" : ""}</p>
    <div class="r" style="font-size:13px;line-height:1.8;margin-bottom:12px">정문 → ${c.stops.map((id) => zoneById(id)?.name || id).join(" → ")}</div>
    <button class="ts-close" style="background:var(--primary,#d4121a);color:#fff">좋아!</button></div>`;
  document.body.appendChild(el);
  el.querySelector(".ts-close").onclick = () => { el.remove(); try { app.goTab("home"); } catch {} };
  playKey("finish-" + c.id, `${c.name} 완주! ${c.badge} 뱃지를 받았어. 같이 돌아서 즐거웠어!`);
}