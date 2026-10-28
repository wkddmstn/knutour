import * as chat from "./chat.js";
import { completeMission } from "./storage.js";
import { reward, esc } from "./ui.js";
import { sendFriendRequest, hasConfirmedTogether } from "./friend.js";
import { joinQueue, leaveQueue, waitForMatch } from "./match.js";
import { isDone } from "./storage.js";
import { startAR, openPhotoStudio, photoItemsFor, MASCOTS } from "./ar.js";   // AR 호반우 (장주연)

const ICON = { photo: "📸", voice: "🎤", quiz: "🧠", code: "🔎", together: "🤝", ar: "✨" };
export const icon = (type) => ICON[type] || "⭐";

const FIRST_TRY_BONUS = 20;

// 미션 1개를 대화로 진행한다. 끝나면 점수를 기록하고 보상 효과를 보여준다.
export async function runMission(m, zone) {
  // "함께하기" 미션은 상대방이 수락해야 완료되므로, 완료 처리를 여기서 바로 하지 않고 별도로 흐른다
  if (m.type === "together") { await together(m); return; }
  if (m.type === "ar") { await arMission(m, zone); return; }   // AR 미션 (장주연)

  // 사진 미션은 끝낸 뒤에도 새 사진으로 다시 찍을 수 있다 (XP는 처음 한 번만)
  const again = m.type === "photo" && isDone(m.id);
  await chat.bot(`<b>${m.title}</b><br>${again ? "새 사진으로 다시 찍어 볼까? (XP는 처음 한 번만 받아요)" : (m.desc || m.question || "")}`);

  let bonus = 0;
  if (m.type === "photo") await photo(m, zone);
  else if (m.type === "voice") await voice(m);
  else if (m.type === "quiz") bonus = await quiz(m);
  else if (m.type === "code") bonus = await code(m);

  if (again) { await chat.bot("새 사진으로 바꿨어! 📸"); return; }

  const pts = m.points + bonus;
  completeMission(m.id, pts);
  reward(pts);
  await chat.bot(
    `미션 완료! <b>+${pts} XP</b>` + (bonus ? `<br>첫 시도 성공 보너스 ${bonus} XP까지 받았어.` : "")
  );
}

/* ---------- AR 미션 (장주연) ---------- */
// zones.json의 { type: "ar", ar: "roulette" | "find" | "petals" | "cheer" | "snack" | "pet" } 미션
async function arMission(m, zone) {
  const again = isDone(m.id);
  await chat.bot(`<b>${m.title}</b><br>${m.desc || ""}`);
  const r = await startAR(zone || { id: "", name: "" }, { mission: m });
  if (!r.done) { await chat.bot("괜찮아, 다음에 다시 도전해 보자!"); return; }
  if (again) { await chat.bot("또 성공했네! 🎉 (XP는 처음 한 번만 받아요)"); return; }
  completeMission(m.id, m.points);
  reward(m.points);
  await chat.bot(`AR 미션 성공! <b>+${m.points} XP</b>`);
}

/* ---------- 함께하기 (친구 코드 상호 확인) ---------- */
async function together(m) {
  if (await hasConfirmedTogether(m.id)) {
    await chat.bot(`<b>${m.title}</b><br>이건 이미 끝낸 미션이야!`);
    return;
  }
  await chat.bot(`<b>${m.title}</b><br>${m.desc || ""}`);

  const withWhom = await chat.choices([
    { label: "친구와 함께 왔어요", value: "friend" },
    { label: "혼자 왔어요 (랜덤 매칭)", value: "random" },
  ]);

  if (withWhom === "friend") await togetherWithFriend(m);
  else await togetherRandom(m);
}

/* ---------- 친구 코드 상호 확인 ---------- */
async function togetherWithFriend(m) {
  await chat.bot("같이 온 친구 코드 알려줄래? '내 정보' 탭에서 확인할 수 있어.");

  while (true) {
    const code = await chat.ask((card, done) => {
      card.innerHTML = `
        <input class="text-in" placeholder="예: K7X9P2" maxlength="6" style="text-transform:uppercase">
        <button class="chip primary">요청 보내기</button>`;
      const input = card.querySelector("input");
      card.querySelector(".chip").onclick = () => input.value.trim() && done(input.value.trim());
    });
    chat.user(esc(code));

    const res = await sendFriendRequest(m.id, code);
    if (res.ok) {
      await chat.bot(`<b>${res.partnerNickname}</b>한테 요청 보냈어!<br>수락하면 둘 다 자동으로 완료되니까 조금만 기다려봐.`);
      return;
    }
    const msg = res.reason === "not_found" ? "그 코드를 가진 사람을 못 찾겠어. 코드 다시 확인해줄래?"
      : res.reason === "self" ? "본인 코드는 입력하면 안 돼! 친구 코드를 입력해줘."
      : "어, 오류가 났어. 다시 시도해줄래?";
    await chat.bot(msg);
  }
}

/* ---------- 랜덤 매칭 ---------- */
async function togetherRandom(m) {
  await chat.bot("랜덤 매칭 해줄게! 몇 가지만 물어볼게, 끝나면 바로 지워지니까 걱정 마.");

  const gender = await chat.choices([
    { label: "남성", value: "m" },
    { label: "여성", value: "f" },
  ]);
  await chat.bot("어떤 사람이랑 매칭해줄까?");
  const wantRaw = await chat.choices([
    { label: "이성", value: "opposite" },
    { label: "동성", value: "same" },
    { label: "상관없어요", value: "any" },
  ]);
  const want = wantRaw === "opposite" ? (gender === "m" ? "f" : "m") : wantRaw === "same" ? gender : "any";

  const res = await joinQueue(m.id, gender, want);
  if (res.matched) {
    // 매칭을 "성사시킨" 쪽은 자기 행동이라 실시간 알림이 자기 화면엔 안 뜨므로, 여기서 바로 완료 처리한다.
    // (매칭을 "기다리던" 상대방은 알림함 구독을 통해 자동으로 완료·XP 지급된다)
    if (completeMission(m.id, m.points)) reward(m.points);
    await chat.bot(`<b>${res.partnerNickname}</b>이랑 매칭 성공! 미션도 바로 완료됐어.`);
    return;
  }

  await chat.bot("매칭 상대 찾는 중이야. 누가 들어오면 바로 연결해줄게.");
  const matched = await chat.ask((card, done) => {
    card.innerHTML = `
      <div style="text-align:center;padding:8px 0">
        <div class="rec-timer">⏳</div>
        <p style="color:var(--mute);font-size:13px;margin:0 0 10px">대기 중...</p>
        <button class="chip ghost">대기 취소하기</button>
      </div>`;
    card.querySelector(".chip").onclick = () => { done(null); };
    const unsubscribe = waitForMatch(m.id, (partnerNickname) => {
      unsubscribe();
      done(partnerNickname);
    });
    chat.onClear(unsubscribe);
  });

  if (!matched) {
    leaveQueue(m.id);
    await chat.bot("매칭 취소했어. 나중에 다시 해보자.");
    return;
  }
  await chat.bot(`<b>${matched}</b>이랑 매칭됐어! 같이 미션 완료해보자.`);
}

/* ---------- 사진 ---------- */
async function photo(m, zone) {
  const withHob = !!(zone && MASCOTS[zone.id]);   // 이 장소에 호반우가 있으면 "호반우와 함께 찍기" 제공 (장주연)
  while (true) {
  const file = await chat.ask((card, done) => {
    card.innerHTML = `
      ${withHob ? `<button class="chip primary hob-cam" style="margin-bottom:8px">🐾 호반우와 함께 찍기</button>` : ""}
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
    card.querySelector(".hob-cam")?.addEventListener("click", () => done("__hob"));
  });
  if (file === "__hob") {
    const shot = await openPhotoStudio({ items: photoItemsFor(zone.id), start: zone.id, submit: true, place: zone.name });
    if (!shot) continue;   // 사진을 안 고르고 닫았으면 다시 선택 화면으로
    chat.user(`<img class="shot" src="${shot.dataUrl}" alt="제출한 사진">`);
    return;
  }
  chat.user(`<img class="shot" src="${URL.createObjectURL(file)}" alt="제출한 사진">`);
  return;
  }
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
      await chat.bot("정답이야!");
      return wrong.size === 0 ? FIRST_TRY_BONUS : 0;
    }
    wrong.add(pick);
    await chat.bot(m.hint ? `아깝다! 힌트 줄게: ${m.hint}` : "아깝다! 다시 골라볼래?");
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
      await chat.bot("정답이야!");
      return tries === 0 ? FIRST_TRY_BONUS : 0;
    }
    tries++;
    await chat.bot(m.hint ? `땡! 힌트 줄게: ${m.hint}` : "땡! 다시 한번 확인해볼래?");
  }
}
