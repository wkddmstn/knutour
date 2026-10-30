// 챗봇 대화 엔진: 말풍선 / 선택 버튼 / 입력 위젯을 대화창(#chat)에 쌓는다.
// clear()를 부르면 진행 중이던 대화는 조용히 중단된다 (구역을 나갈 때 사용).

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const forever = () => new Promise(() => {}); // 중단된 대화의 Promise는 영원히 대기

let session = 0;
const cleanups = [];

export function onClear(fn) { cleanups.push(fn); }   // 예: 마이크 끄기

export function clear() {
  session++;
  cleanups.splice(0).forEach((fn) => { try { fn(); } catch {} });
  $("chat").innerHTML = "";
}

function scrollDown() {
  requestAnimationFrame(() => {
    if (document.body.dataset.view !== "zone") return;   // 다른 화면으로 나갔으면 스크롤하지 않음
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });
}

/* ---------- 대화 기록 저장 (새로고침/다른 화면 이동 후에도 유지) ---------- */
// 아직 답하지 않은 선택지·위젯·"입력 중..." 표시는 저장하지 않는다
// (저장된 HTML을 그대로 복원하면 버튼에 클릭 이벤트가 안 붙어서 눌러도 반응이 없기 때문)
let persistFn = null;
export function setPersist(fn) { persistFn = fn; }

function snapshot() {
  const clone = $("chat").cloneNode(true);
  clone.querySelectorAll(".row.choices, .row.widget, .bubble.typing").forEach((el) => {
    (el.closest(".row") || el).remove();
  });
  fixDeadMedia(clone);
  return clone.innerHTML;
}

// blob: 주소(사진·녹음 미리보기)는 새로고침하면 사라져서, 저장했다 복원하면 깨진 이미지와 콘솔 오류가 생긴다.
// 저장할 때와 예전에 저장된 기록을 복원할 때, 이런 것들을 글자 표시로 바꿔 둔다.
export function fixDeadMedia(root) {
  const swap = (el, text) => {
    const s = document.createElement("span");
    s.className = "media-gone";
    s.textContent = text;
    el.replaceWith(s);
  };
  root.querySelectorAll('img[src^="blob:"]').forEach((el) => swap(el, "📷 제출한 사진"));
  root.querySelectorAll('audio[src^="blob:"]').forEach((el) => swap(el, "🎙️ 제출한 녹음"));
  // 예전 기록의 아바타(전신 그림)도 얼굴 프로필로
  root.querySelectorAll(".row-avatar").forEach((el) => { if (el.getAttribute("src") !== AVATAR) el.setAttribute("src", AVATAR); });
}

function persist() {
  if (persistFn) persistFn(snapshot());
}

// 봇 말풍선에 붙는 호반우 프로필(얼굴만 동그랗게). 카카오톡처럼 "연속된 봇 메시지 중 첫 번째"에만
// 보이도록 하는데, 실제 보일지 말지는 style.css의 :not(.row.bot + .row.bot) 규칙이 처리한다.
const AVATAR = "img/mascot/avatar.png";
function avatarHtml() {
  return `<img class="row-avatar" src="${AVATAR}" alt="">`;
}

function row(cls, html) {
  const d = document.createElement("div");
  d.className = "row " + cls;
  d.innerHTML = (cls === "bot" ? avatarHtml() : "") + html;
  $("chat").appendChild(d);
  scrollDown();
  persist();
  return d;
}

// 말풍선 하나에 여러 문장을 한꺼번에 쏟아내지 않도록 문장 단위로 나눈다.
// <br>에서 먼저 나누고, 그 안에서는 문장부호(. ! ? …) 뒤 공백에서 나눈다. <b>처럼 글 안에 들어간 태그가
// 열려 있는 동안은 자르지 않는다. 사진·버튼 같은 덩어리 HTML이 들어 있으면 나누지 않고 통째로 둔다.
const textLen = (html) => html.replace(/<[^>]*>/g, "").length;
function splitSentences(html) {
  if (/<(img|audio|video|button|div|ul|ol|table|a|label|input)\b/i.test(html)) return [html];
  const out = [];
  for (const part of html.split(/<br\s*\/?>/i)) {
    let depth = 0, start = 0;
    for (let i = 0; i < part.length; i++) {
      if (part[i] === "<") {
        const end = part.indexOf(">", i);
        if (end < 0) break;
        const tag = part.slice(i, end + 1);
        if (!/^<\//.test(tag) && !/\/>$/.test(tag)) depth++;
        else if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
        i = end;
        continue;
      }
      if (depth === 0 && /[.!?…~]/.test(part[i]) && /\s/.test(part[i + 1] || "") && !/\d/.test(part[i - 1] || "")) {
        out.push(part.slice(start, i + 1));
        start = i + 1;
      }
    }
    out.push(part.slice(start));
  }
  // 이모지만 남은 조각(예: "…해볼까? 😊")은 앞 문장에 붙인다
  return out.map((p) => p.trim()).filter(Boolean).reduce((acc, p) => {
    if (acc.length && !/[0-9A-Za-z가-힣]/.test(p.replace(/<[^>]*>/g, ""))) acc[acc.length - 1] += " " + p;
    else acc.push(p);
    return acc;
  }, []);
}

// 대화창 맨 끝이 이미 이 말(답장 없이 그대로 남은 같은 말풍선들)로 끝나는지.
// 장소에 다시 들어오면 미션 메뉴가 같은 질문을 또 하는데, 답하지 않은 질문이 쌓이지 않게 한다.
// (문장 단위로 나누기 전에 저장된 예전 기록은 말풍선 하나에 통째로 들어 있어서 그것도 같은 말로 본다)
function endsWith(html, parts) {
  const rows = [...$("chat").children].filter((r) => !r.matches(".row.choices, .row.widget") && !r.querySelector(".bubble.typing"));
  const said = (r) => (r.classList.contains("bot") ? r.querySelector(".bubble")?.innerHTML.trim() : null);
  const tail = rows.slice(-parts.length);
  if (tail.length === parts.length && tail.every((r, i) => said(r) === parts[i])) return true;
  return rows.length > 0 && said(rows[rows.length - 1]) === html.trim();
}

// 저장해 둔 대화를 복원했을 때, 위 문제로 이미 똑같은 봇 말풍선이 연달아 쌓여 있으면 하나만 남긴다
export function dedupeRepeats() {
  let prev = null;
  [...$("chat").children].forEach((r) => {
    const said = r.classList.contains("bot") ? r.querySelector(".bubble")?.innerHTML.trim() : null;
    if (said && said === prev) r.remove();
    else prev = said;
  });
}

// 가이드(봇) 말풍선. 문장마다 "입력 중..." 표시 후 한 말풍선씩 나타난다.
// 다음 문장은 앞 문장을 읽을 시간(글자 수에 비례, 최대 약 2초)만큼 기다렸다가 보여 준다.
// 답장 없이 방금 한 말과 똑같은 말이면 다시 말하지 않는다.
// whole: true면 나누지 않고 한 말풍선에 (예: "정답! +115 XP"처럼 결과와 XP를 한 번에 보여 줄 때)
export async function bot(html, { whole = false } = {}) {
  const s = session;
  const parts = whole ? [html] : splitSentences(html);
  if (endsWith(html, parts)) return;
  for (let i = 0; i < parts.length; i++) {
    const typing = row("bot", `<div class="bubble typing"><i></i><i></i><i></i></div>`);
    await sleep(i === 0
      ? 350 + Math.min(textLen(parts[0]) * 8, 700)
      : 600 + Math.min(textLen(parts[i - 1]) * 30, 1400));
    if (s !== session) return forever();
    typing.remove();
    row("bot", `<div class="bubble">${parts[i]}</div>`);
  }
}

// 내 말풍선
export function user(html) {
  row("user", `<div class="bubble">${html}</div>`);
}

// 선택 버튼. 누르면 내 말풍선으로 바뀌고 선택한 value를 돌려준다
export function choices(items) {
  const s = session;
  return new Promise((resolve) => {
    const wrap = row("choices", "");
    items.forEach((it) => {
      const b = document.createElement("button");
      b.className = "chip" + (it.ghost ? " ghost" : "");
      b.innerHTML = it.label;
      b.disabled = !!it.disabled;
      b.onclick = () => {
        if (s !== session) return;
        wrap.remove();
        user(it.label);
        resolve(it.value);
      };
      wrap.appendChild(b);
    });
    scrollDown();
  });
}

// 입력 위젯(카메라, 녹음, 텍스트 입력 등). builder(card, done)에서 UI를 만들고 done(값)을 부르면 위젯이 사라진다
export function ask(builder) {
  const s = session;
  return new Promise((resolve) => {
    const w = row("widget", `<div class="bubble widget-card"></div>`);
    const card = w.querySelector(".widget-card");
    builder(card, (value) => {
      if (s !== session) return;
      w.remove();
      resolve(value);
    });
    scrollDown();
  });
}