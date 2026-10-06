import * as chat from "./chat.js";
import { completeMission } from "./storage.js";
import { reward, esc } from "./ui.js";

const ICON = { photo: "📸", voice: "🎤", quiz: "🧠", code: "🔎" };
export const icon = (type) => ICON[type] || "⭐";

const FIRST_TRY_BONUS = 20;

// 미션 1개를 대화로 진행한다. 끝나면 점수를 기록하고 보상 효과를 보여준다.
export async function runMission(m) {
  await chat.bot(`<b>${m.title}</b><br>${m.desc || m.question || ""}`);

  let bonus = 0;
  if (m.type === "photo") await photo();
  else if (m.type === "voice") await voice(m);
  else if (m.type === "quiz") bonus = await quiz(m);
  else if (m.type === "code") bonus = await code(m);

  const pts = m.points + bonus;
  completeMission(m.id, pts);
  reward(pts);
  await chat.bot(
    `미션을 완료했어요. <b>+${pts} XP</b>` + (bonus ? `<br>첫 시도 성공 보너스 ${bonus} XP가 포함됐어요.` : "")
  );
}

/* ---------- 사진 ---------- */
async function photo() {
  const file = await chat.ask((card, done) => {
    card.innerHTML = `
      <label class="btn-file">사진 찍기 · 선택하기
        <input type="file" accept="image/*" capture="environment" hidden>
      </label>
      <img class="preview hidden" alt="미리보기">
      <button class="chip primary hidden">이 사진으로 제출</button>`;
    const input = card.querySelector("input");
    const img = card.querySelector("img");
    const send = card.querySelector(".chip");
    let picked = null;
    input.onchange = () => {
      picked = input.files[0];
      if (!picked) return;
      img.src = URL.createObjectURL(picked);
      img.classList.remove("hidden");
      send.classList.remove("hidden");
    };
    send.onclick = () => picked && done(picked);
  });
  chat.user(`<img class="shot" src="${URL.createObjectURL(file)}" alt="제출한 사진">`);
}

/* ---------- 음성 ---------- */
async function voice(m) {
  const sec = m.seconds || 10;
  const blob = await chat.ask((card, done) => {
    card.innerHTML = `
      <div class="rec-timer">0 / ${sec}초</div>
      <button class="rec">녹음 시작</button>
      <audio class="hidden" controls></audio>
      <div class="btns hidden">
        <button class="chip retry">다시 녹음</button>
        <button class="chip primary send">제출</button>
      </div>
      <p class="hint"></p>`;
    const timerEl = card.querySelector(".rec-timer");
    const recBtn = card.querySelector(".rec");
    const audio = card.querySelector("audio");
    const btns = card.querySelector(".btns");
    const hint = card.querySelector(".hint");

    let rec = null, stream = null, chunks = [], timer = null, t0 = 0, result = null;
    const cleanup = () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());   // 마이크 끄기
    };
    chat.onClear(cleanup);

    recBtn.onclick = async () => {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        hint.textContent = "이 브라우저에서는 녹음을 지원하지 않아요. 크롬이나 사파리 최신 버전을 사용해 주세요.";
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        hint.textContent = "마이크를 사용할 수 없어요. 브라우저 설정에서 마이크 권한을 허용해 주세요.";
        return;
      }
      hint.textContent = "";
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cleanup();
        result = new Blob(chunks, { type: rec.mimeType });
        audio.src = URL.createObjectURL(result);
        audio.classList.remove("hidden");
        btns.classList.remove("hidden");
        recBtn.classList.add("hidden");
      };
      rec.start();
      t0 = Date.now();
      recBtn.textContent = "녹음 끝내기";
      recBtn.classList.add("recording");
      timer = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        timerEl.textContent = `${Math.floor(s)} / ${sec}초`;
        if (s >= sec) rec.stop();
      }, 200);
    };

    card.querySelector(".retry").onclick = () => {
      audio.classList.add("hidden");
      btns.classList.add("hidden");
      recBtn.classList.remove("hidden", "recording");
      recBtn.textContent = "녹음 시작";
      timerEl.textContent = `0 / ${sec}초`;
    };
    card.querySelector(".send").onclick = () => result && done(result);
  });
  chat.user(`녹음을 제출했어요<br><audio controls src="${URL.createObjectURL(blob)}"></audio>`);
}

/* ---------- 퀴즈 ---------- */
async function quiz(m) {
  const wrong = new Set();
  while (true) {
    const opts = m.choices
      .map((label, i) => ({ label, value: i }))
      .filter((o) => !wrong.has(o.value));
    const pick = await chat.choices(opts);
    if (pick === m.answer) {
      await chat.bot("정답이에요!");
      return wrong.size === 0 ? FIRST_TRY_BONUS : 0;
    }
    wrong.add(pick);
    await chat.bot(m.hint ? `아쉬워요. 힌트를 드릴게요: ${m.hint}` : "아쉬워요. 다시 골라 볼까요?");
  }
}

/* ---------- 텍스트 정답(안내판 숫자 등) ---------- */
const norm = (s) => String(s).trim().replace(/\s+/g, "").toLowerCase();

async function code(m) {
  let tries = 0;
  while (true) {
    const val = await chat.ask((card, done) => {
      card.innerHTML = `
        <input class="text-in" placeholder="${esc(m.placeholder || "정답 입력")}" autocomplete="off">
        <button class="chip primary">제출</button>`;
      const input = card.querySelector("input");
      const go = () => input.value.trim() && done(input.value.trim());
      card.querySelector(".chip").onclick = go;
      input.onkeydown = (e) => { if (e.key === "Enter") go(); };
    });
    chat.user(esc(val));
    if (norm(val) === norm(m.answer)) {
      await chat.bot("정답이에요!");
      return tries === 0 ? FIRST_TRY_BONUS : 0;
    }
    tries++;
    await chat.bot(m.hint ? `정답이 아니에요. 힌트를 드릴게요: ${m.hint}` : "정답이 아니에요. 다시 한 번 확인해 볼까요?");
  }
}
