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

function row(cls, html) {
  const d = document.createElement("div");
  d.className = "row " + cls;
  d.innerHTML = html;
  $("chat").appendChild(d);
  scrollDown();
  return d;
}

const AVATAR = `<div class="avatar">🦉</div>`;

// 가이드(봇) 말풍선. "입력 중..." 표시 후 나타남
export async function bot(html) {
  const s = session;
  const typing = row("bot", `${AVATAR}<div class="bubble typing"><i></i><i></i><i></i></div>`);
  await sleep(350 + Math.min(html.length * 8, 700));
  if (s !== session) return forever();
  typing.remove();
  row("bot", `${AVATAR}<div class="bubble">${html}</div>`);
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
