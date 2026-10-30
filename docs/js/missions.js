import * as chat from "./chat.js";
import { completeMission } from "./storage.js";
import { reward, esc, showComposer } from "./ui.js";
import { sendFriendRequest, hasConfirmedTogether } from "./friend.js";
import * as together2 from "./together.js";   // 함께 돌기 실시간 미션 (대운동장)
import { joinQueue, leaveQueue, waitForMatch } from "./match.js";
import { isDone, getPhotoHashes, savePhotoHash } from "./storage.js";
import { startAR, openPhotoStudio, photoItemsFor, MASCOTS } from "./ar.js";   // AR 호반우 (장주연)
import { getCachedProfile } from "./supa.js";
import { postCommunity } from "./community.js";
import { verifyMissionPhoto } from "./verify.js";
import { computeAHash, hammingDistance } from "./phash.js";

const ICON = { photo: "📸", voice: "🎤", quiz: "🧠", code: "🔎", together: "🤝", ar: "✨", visit: "📲" };
export const icon = (type) => ICON[type] || "⭐";

const FIRST_TRY_BONUS = 20;
const DUPLICATE_HASH_THRESHOLD = 10;   // 64비트 중 이만큼 이내로 다르면 "같은 사진 재사용"으로 본다

// 미션 1개를 대화로 진행한다. 끝나면 점수를 기록하고 보상 효과를 보여준다.
// ctx(함께 돌기용): { demo, map(), openMap(), join: { partnerId, partnerName, role } }  — join이 있으면 코드 입력 없이 바로 세션으로
export async function runMission(m, zone, ctx = {}) {
  // "함께하기" 미션은 상대방이 수락해야 완료되므로, 완료 처리를 여기서 바로 하지 않고 별도로 흐른다
  if (m.type === "together" && m.live) { await togetherLive(m, zone, ctx); return; }
  if (m.type === "together") { await together(m); return; }
  if (m.type === "ar") { await arMission(m, zone); return; }   // AR 미션 (장주연)

  // 사진 미션은 끝낸 뒤에도 새 사진으로 다시 찍을 수 있다 (XP는 처음 한 번만)
  const again = m.type === "photo" && isDone(m.id);
  await chat.bot(`<b>${m.title}</b><br>${again ? "새 사진으로 다시 찍어 볼까? (XP는 처음 한 번만 받아요)" : (m.desc || m.question || "")}`, { whole: true });

  // 채팅은 간결하게: 미션 결과와 받은 XP를 말풍선 하나로 ("정답! +115 XP", "사진 통과! ✅ +100 XP")
  let bonus = 0, done = "미션 완료!", shot = null;
  if (m.type === "photo") ({ shot, done } = await photo(m, zone));
  else if (m.type === "voice") { await voice(m); done = "녹음 완료!"; }
  else if (m.type === "quiz") { bonus = await quiz(m); done = "정답!"; }
  else if (m.type === "code") { bonus = await code(m); done = "정답!"; }
  else if (m.type === "visit") { await visit(m); done = m.doneText || "다녀왔구나!"; }

  if (again) { await chat.bot("새 사진으로 바꿨어! 📸"); await offerCommunityUpload(zone, shot); return; }

  const pts = m.points + bonus;
  completeMission(m.id, pts);
  reward(pts);
  await chat.bot(`${done} <b>+${pts} XP</b>${bonus ? ` <small>(첫 시도 보너스 포함)</small>` : ""}`, { whole: true });
  if (m.type === "photo") await offerCommunityUpload(zone, shot);   // 사진은 커뮤니티에도 올릴지 물어본다
}

/* ---------- AR 미션 (장주연) ---------- */
// zones.json의 { type: "ar", ar: "roulette" | "find" | "petals" | "cheer" | "snack" | "pet" } 미션
async function arMission(m, zone) {
  const again = isDone(m.id);
  await chat.bot(`<b>${m.title}</b><br>${m.desc || ""}`, { whole: true });
  const r = await startAR(zone || { id: "", name: "" }, { mission: m });
  if (!r.done) { await chat.bot("괜찮아, 다음에 다시 도전해 보자!"); return; }
  if (again) { await chat.bot("또 성공했네! 🎉 (XP는 처음 한 번만 받아요)"); return; }
  completeMission(m.id, m.points);
  reward(m.points);
  await chat.bot(`AR 미션 성공! <b>+${m.points} XP</b>`, { whole: true });
}

/* ---------- 함께하기 (친구 코드 상호 확인) ---------- */
async function together(m) {
  if (await hasConfirmedTogether(m.id)) {
    await chat.bot(`<b>${m.title}</b><br>이건 이미 끝낸 미션이야!`);
    return;
  }
  await chat.bot(`<b>${m.title}</b><br>${m.desc || ""}`);

  // 랜덤 매칭은 아직 실제 서버 없이 같은 브라우저 안에서만 동작해서(localdb), 켜기 전까지는 친구 코드 확인만 쓴다
  if (!RANDOM_MATCH_ON) { await togetherWithFriend(m); return; }

  const withWhom = await chat.choices([
    { label: "친구와 함께 왔어요", value: "friend" },
    { label: "혼자 왔어요 (랜덤 매칭)", value: "random" },
  ]);

  if (withWhom === "friend") await togetherWithFriend(m);
  else await togetherRandom(m);
}
const RANDOM_MATCH_ON = false;   // 랜덤 매칭을 Supabase로 옮긴 뒤 true로

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

/* ---------- 함께 돌기 (실시간, together.js) ---------- */
// 친구 코드 → 친구 수락 → 둘 다 위치 인증 → 둘 다 트랙 한 바퀴 → 성공.
// 진행 중 한 명이라도 구역 밖에 30초 넘게 있으면 실패(처음부터 다시).
async function togetherLive(m, zone, ctx) {
  if (isDone(m.id)) {
    await chat.bot(`<b>${m.title}</b><br>이건 이미 끝낸 미션이야!`);
    return;
  }
  const me = getCachedProfile();
  let join = ctx.join || null;
  const pending = together2.getPending();
  if (!join && pending && pending.missionId === m.id) {
    await chat.bot(`<b>${esc(pending.partnerName)}</b>랑 하던 함께 돌기가 있어. 이어서 할까?`);
    const pick = await chat.choices([
      { label: "이어서 하기", value: "resume" },
      { label: "다른 친구랑 새로 하기", value: "new", ghost: true },
    ]);
    if (pick === "resume") join = pending;
    else together2.clearPending();
  }

  await chat.bot(`<b>${m.title}</b><br>${m.desc || ""}`);
  if (!join) {
    await chat.bot("같이 돌 친구 코드 알려줄래? '내 정보' 탭에서 확인할 수 있어.");
    while (!join) {
      const code = await chat.ask((card, done) => {
        card.innerHTML = `
          <input class="text-in" placeholder="예: K7X9P2" maxlength="6" style="text-transform:uppercase">
          <button class="chip primary">요청 보내기</button>`;
        const input = card.querySelector("input");
        const go = () => input.value.trim() && done(input.value.trim());
        card.querySelector(".chip").onclick = go;
        input.onkeydown = (e) => { if (e.key === "Enter") go(); };
      });
      chat.user(esc(code));
      const res = await sendFriendRequest(m.id, code).catch(() => ({ ok: false, reason: "error" }));
      if (res.ok) {
        join = { partnerId: res.partnerId, partnerName: res.partnerNickname, role: "requester" };
        await chat.bot(`<b>${esc(res.partnerNickname)}</b>한테 요청 보냈어!<br>친구가 알림에서 <b>수락</b>하면 둘 다 위치 인증하고 바로 시작해.`);
        break;
      }
      await chat.bot(res.reason === "not_found" ? "그 코드를 가진 사람을 못 찾겠어. 코드 다시 확인해줄래?"
        : res.reason === "self" ? "본인 코드는 입력하면 안 돼! 친구 코드를 입력해줘."
        : "어, 오류가 났어. 다시 시도해줄래?");
    }
  } else if (join.role === "partner") {
    await chat.bot(`<b>${esc(join.partnerName)}</b>의 함께 돌기 요청을 수락했어! 운동장 안에서 위치 인증하면 시작해.`);
  }
  together2.savePending({ missionId: m.id, zoneId: zone.id, ...join });

  const result = await together2.runSession({
    key: together2.pairKey(m.id, me.id, join.partnerId),
    mission: m, zone, partnerName: join.partnerName, role: join.role,
    demo: !!ctx.demo, map: ctx.map, onMapOpen: ctx.openMap, ask: chat.ask, onClear: chat.onClear,
  });
  together2.clearPending();
  if (result === "done") {
    if (completeMission(m.id, m.points)) reward(m.points);
    await chat.bot(`<b>${esc(join.partnerName)}</b>랑 대운동장 한 바퀴 완주! 🎉 <b>+${m.points} XP</b>`);
  } else {
    await chat.bot("함께 돌기는 여기까지! 다음에 다시 도전해 보자.");
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
// 사진 미션은 앱 안 카메라 화면(투어·카메라 탭과 같은 화면)으로 그 자리에서 찍은 사진만 받는다.
// (앨범 사진 업로드는 없앴다. <input capture>는 카카오톡 같은 인앱 브라우저에서 앨범 선택이 먼저 뜨기도 해서)
async function photo(m, zone) {
  // (장주연) 장소 미션에서는 AR 호반우 선택칸을 뺐다 (호반우는 홈 "AR 호반우 만나기"·도감에서). 다시 넣으려면 HOB_IN_PHOTO = true
  const HOB_IN_PHOTO = false;
  const withHob = HOB_IN_PHOTO && !!(zone && MASCOTS[zone.id]);
  while (true) {
    const file = await chat.ask((card, done) => {
      card.innerHTML = `
        ${withHob ? `<button class="chip primary hob-cam" style="margin-bottom:8px">🐾 호반우와 함께 찍기</button>` : ""}
        <button class="btn-file cam-shot">사진 찍기</button>`;
      card.querySelector(".hob-cam")?.addEventListener("click", () => done("__hob"));
      card.querySelector(".cam-shot")?.addEventListener("click", () => done("__cam"));
    });

    let shot;   // 커뮤니티에 올릴 때 쓸 사진 (dataURL 문자열)
    if (file === "__hob") {
      const studio = await openPhotoStudio({ items: photoItemsFor(zone.id), start: zone.id, submit: true, place: zone.name });
      if (!studio) continue;   // 사진을 안 고르고 닫았으면 다시 선택 화면으로
      shot = studio.dataUrl;
      chat.user(`<img class="shot" src="${studio.dataUrl}" alt="제출한 사진">`);
    } else {
      const studio = await openPhotoStudio({ start: "basic", submit: true, place: zone.name, zoneId: zone.id, plain: true });
      if (studio?.nocam) { await chat.bot("카메라를 켤 수 없어. 브라우저 설정에서 카메라 권한을 허용하고 다시 눌러 줘!"); continue; }
      if (!studio?.dataUrl) continue;   // 찍지 않고 닫았으면 다시 사진 찍기 버튼으로
      shot = studio.dataUrl;
      chat.user(`<img class="shot" src="${studio.dataUrl}" alt="제출한 사진">`);
    }

    // 1단계(무료): 이 사진이 이미 "다른" 미션에서 제출했던 사진이랑 거의 똑같은지 먼저 확인한다.
    // AI(Gemini) 호출 전에 공짜로 걸러내서, 뻔한 사진 재사용은 AI를 부르지도 않고 바로 거절한다.
    let hash = null;
    try {
      hash = await computeAHash(shot);
      const hashes = getPhotoHashes();
      const isDuplicate = Object.entries(hashes).some(
        ([otherMissionId, otherHash]) => otherMissionId !== m.id && hammingDistance(hash, otherHash) <= DUPLICATE_HASH_THRESHOLD
      );
      if (isDuplicate) {
        await chat.bot("어? 이거 다른 미션에서 찍었던 사진이랑 거의 똑같아 보이는데? 이 미션에 맞는 새 사진으로 찍어줄래?");
        continue;
      }
    } catch {
      // 해시 계산이 실패해도(지원 안 되는 파일 형식 등) 그냥 다음 단계(AI 검증)로 진행한다
    }

    // 2단계(AI): 재사용 사진이 아니면, 그제서야 Gemini한테 미션 내용과 맞는 사진인지 물어본다.
    // 검사는 바로 시작하고, 그동안 "확인하고 있어요" 말풍선을 보여준다 (말풍선 애니메이션을 기다렸다 시작하면 그만큼 느려짐)
    const verdictP = verifyMissionPhoto(m.title, m.desc, shot, m.id);
    await chat.bot("사진을 확인하고 있어요... 🔍");
    const verdict = await verdictP;
    if (!verdict.ok) {
      await chat.bot(
        (verdict.reason ? `음, ${verdict.reason}` : "이 미션이랑 잘 안 맞는 사진 같아.") + " 다른 사진으로 다시 찍어볼래?"
      );
      continue;
    }

    if (hash) savePhotoHash(m.id, hash);   // 통과한 사진의 해시를 기억해뒀다가, 다음 미션에서 재사용하면 잡아낸다

    // 통과했다고 바로 알려준다 (예전엔 말없이 버튼만 떠서 멈춘 것처럼 보였음)
    // review: 사진 검사를 못 했지만(한도 도달·일시 오류) 막지 않고 받아 준 경우
    return { shot, done: verdict.review ? "사진 잘 받았어! ✅" : "사진 통과! ✅" };
  }
}

// 사진 미션을 마친 뒤, 방금 찍은 사진을 커뮤니티 게시판에도 바로 올릴 수 있는 선택지를 준다.
// "업로드" 버튼을 누르면 커뮤니티 글쓰기 창이 뜨고, 올리거나 닫으면 자동으로 미션 대화로 돌아온다.
async function offerCommunityUpload(zone, shot) {
  if (!shot) return;
  const pick = await chat.choices([
    { label: "📤 커뮤니티에도 올리기", value: "up" },
    { label: "다음으로", value: "skip", ghost: true },
  ]);
  if (pick !== "up") return;

  await new Promise((resolve) => {
    showComposer({
      zoneId: zone?.id || null,
      zoneName: zone?.name || "",
      lockZone: true,
      photo: shot,
      onSubmit: async (message) => {
        const nickname = getCachedProfile()?.nickname || "익명";
        return await postCommunity(zone?.id || null, nickname, message, shot);
      },
      onClose: resolve,
    });
  });
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
    if (pick === m.answer) return wrong.size === 0 ? FIRST_TRY_BONUS : 0;
    wrong.add(pick);
    await chat.bot(m.hint ? `아깝다! 힌트 줄게: ${m.hint}` : "아깝다! 다시 골라볼래?");
  }
}

/* ---------- 링크 방문 (예: 공식당 인스타그램) ---------- */
// zones.json { type: "visit", url, button } — 버튼을 누르면 새 탭으로 열리고, 앱을 잠깐(3초 이상) 떠났다가
// 돌아오면 다녀온 것으로 본다. 돌아온 걸 알아채지 못하는 경우(PC 등)를 위해 5초 뒤 "다녀왔어요" 버튼도 띄운다.
async function visit(m) {
  await chat.ask((card, done) => {
    card.innerHTML = `
      <a class="chip primary visit-go" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.button || "방문하기")} ↗</a>
      <p class="sum-foot visit-hint" style="margin:8px 2px 0">둘러보고 이 화면으로 돌아오면 XP를 받아요.</p>
      <button class="chip hidden visit-back" style="margin-top:8px">다녀왔어요</button>`;
    let leftAt = 0, opened = false, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener("visibilitychange", onVis);
      done(true);
    };
    const onVis = () => {
      if (document.hidden) { leftAt = Date.now(); return; }
      if (opened && leftAt && Date.now() - leftAt >= 3000) finish();
    };
    document.addEventListener("visibilitychange", onVis);
    chat.onClear(() => document.removeEventListener("visibilitychange", onVis));   // 장소를 나가면 정리
    card.querySelector(".visit-go").addEventListener("click", () => {
      opened = true;
      card.querySelector(".visit-hint").textContent = "다 보고 돌아오면 미션이 완료돼요!";
      setTimeout(() => card.querySelector(".visit-back")?.classList.remove("hidden"), 5000);
    });
    card.querySelector(".visit-back").onclick = finish;
  });
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
    if (norm(val) === norm(m.answer)) return tries === 0 ? FIRST_TRY_BONUS : 0;
    tries++;
    await chat.bot(m.hint ? `땡! 힌트 줄게: ${m.hint}` : "땡! 다시 한번 확인해볼래?");
  }
}