// js/together.js — "함께 돌기" 실시간 미션 (대운동장)
//
// 흐름
//   1) 내가 친구 코드를 입력해 요청 → 친구가 알림에서 수락 → 친구 앱도 대운동장 화면으로 이동
//   2) 둘 다 "운동장 안에 있어요(위치 인증)"를 해야 시작
//   3) 둘 다 트랙의 체크포인트 4곳(북·동·남·서)을 지나 출발점으로 돌아오면 성공 → 둘 다 XP
//   4) 진행 중 한 명이라도 운동장(구역) 밖으로 나가면 두 화면 모두 경고 + 30초 카운트다운
//      30초 안에 안 돌아오면 미션 실패 → 처음부터 다시
//
// 두 사람의 상태는 Supabase Realtime "broadcast" 채널(together-<미션 id>-<두 사람 id>)로 주고받는다.
// 새 표(table)는 필요 없다. 2초마다 내 상태 전체를 보내서, 메시지 하나가 빠져도 다음 신호로 맞춰진다.
//
// 데모 모드에서는 GPS 대신 가상 위치를 쓰고, "트랙 한 바퀴 걷기"·"구역 밖으로 나가기" 버튼으로 시연한다.

import { client, getCachedProfile } from "./supa.js";
import * as geo from "./geo.js";

const OUT_LIMIT_S = 30;    // 구역 밖에 이만큼 있으면 실패
const STALE_MS = 12000;    // 친구 신호가 이만큼 끊기면 "연결 끊김"(구역 이탈과 똑같이 경고)
const BEAT_MS = 2000;      // 내 상태를 보내는 간격
const CP_RADIUS = 20;      // 체크포인트를 "지났다"고 보는 거리(m)

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 받침에 따라 조사 고르기: josa("주연", "이", "가") → "주연이"
function josa(name, withBatchim, without) {
  const c = String(name).charCodeAt(String(name).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 > 0 : false;
  return esc(name) + (has ? withBatchim : without);
}

let active = null;   // 지금 진행 중인 세션의 채널 키 (같은 세션이 두 번 열리지 않게)
export const activeKey = () => active;
// 미션 + 두 사람으로 정해지는 채널 키. 요청한 쪽·수락한 쪽 모두 같은 값이 나온다.
export const pairKey = (missionId, a, b) => missionId + "-" + [a, b].sort().join("-");

/* ---------- 진행 중인 함께 미션 기억 (새로고침해도 이어하기) ---------- */
const PENDING_KEY = "knutour_together_pending";
const PENDING_TTL = 2 * 60 * 60 * 1000;   // 2시간 지나면 잊는다
export function savePending(p) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, at: Date.now() })); } catch {}
}
export function getPending() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (p && Date.now() - p.at < PENDING_TTL) return p;
  } catch {}
  return null;
}
export function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

/* ---------- 한 바퀴 판정 ---------- */
// 체크포인트를 모두 지나고 처음 지난 곳(출발점)으로 다시 오면 한 바퀴. 도는 방향은 상관없다.
function makeLap(points) {
  const lap = { visited: [], start: -1, back: false };
  lap.update = (pos) => {
    if (lap.back) return false;
    let changed = false;
    points.forEach((p, i) => {
      if (geo.distanceM(pos, p) > CP_RADIUS) return;
      if (!lap.visited.includes(i)) {
        lap.visited.push(i);
        if (lap.start < 0) lap.start = i;
        changed = true;
      } else if (i === lap.start && lap.visited.length === points.length) {
        lap.back = true;
        changed = true;
      }
    });
    return changed;
  };
  lap.reset = () => { lap.visited = []; lap.start = -1; lap.back = false; };
  return lap;
}

// 진행 정도 0~(N+1): 체크포인트 N곳 + 출발점 복귀 1
const progressOf = (visitedCount, back) => visitedCount + (back ? 1 : 0);

/* ---------- 세션 ---------- */
// opts: { key(pairKey), mission, zone, partnerName, role("requester"|"partner"), demo, map(): CampusMap|null,
//         onMapOpen(): 지도 펼치기, ask: chat.ask }
// 결과: "done"(성공) | "quit"(그만둠)
export function runSession(opts) {
  const { key, mission, zone, demo, ask } = opts;
  const points = mission.lap || [];
  const N = points.length;
  const me = getCachedProfile() || {};
  const myId = me.id || "me-" + Math.random().toString(36).slice(2);
  const myName = me.nickname || "나";
  let partnerName = opts.partnerName || "친구";

  active = key;

  return ask((card, done) => {
    // ----- 상태 -----
    let round = 1;
    let phase = "wait";      // wait(수락·인증 대기) | run(진행 중) | fail(실패) | done(성공) | bye(친구가 그만둠)
    let ready = false;
    let inside = true;
    let pos = demo ? { ...points[0], accuracy: 5 } : null;   // 데모: 출발점(북쪽)에서 시작
    const lap = makeLap(points);
    let peer = null;         // 친구가 마지막으로 보낸 상태 { round, ready, inside, lat, lng, visited, back, name, at }
    let outSince = null;     // 누군가 구역 밖에 나간 시각 (진행 중일 때만)
    let finished = false;
    let walking = null;      // 데모 걷기 타이머
    let parked = null;       // 데모: 밖으로 나가기 전 위치
    let watchId = null;

    card.classList.add("tg-card");
    card.innerHTML = `
      <div class="tg-head">🤝 <b class="tg-title"></b><span class="tg-phase"></span></div>
      <div class="tg-people">
        <div class="tg-person" data-who="me"></div>
        <div class="tg-person" data-who="peer"></div>
      </div>
      <div class="tg-msg"></div>
      <div class="tg-btns"></div>`;
    const $c = (sel) => card.querySelector(sel);

    // ----- 경고 배너 (구역 화면 맨 위) -----
    const banner = document.createElement("div");
    banner.className = "geofence-banner tg-warn";
    const zoneView = document.getElementById("view-zone");
    zoneView?.insertBefore(banner, zoneView.firstChild);

    // ----- 실시간 채널 -----
    const channel = client.channel("together-" + key, { config: { broadcast: { self: false } } });
    const send = (event, payload = {}) => channel.send({ type: "broadcast", event, payload: { uid: myId, ...payload } });
    const myState = () => ({
      name: myName, round, ready, inside, phase,
      lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      visited: lap.visited, back: lap.back,
    });
    const beat = () => { if (!finished) send("st", myState()); };

    channel
      .on("broadcast", { event: "st" }, ({ payload }) => {
        if (payload.uid === myId) return;
        const first = !peer;
        peer = { ...payload, at: Date.now() };
        if (payload.name) partnerName = payload.name;
        if (first) beat();   // 친구가 막 들어왔으면 내 상태를 바로 알려준다
        // 친구가 이미 다음 도전으로 넘어갔는데 나는 진행 중이면 → 실패 신호를 놓친 것
        if (peer.round > round && phase === "run") fail(false);
        drawMap();
        step();
      })
      .on("broadcast", { event: "fail" }, ({ payload }) => {
        if (payload.uid !== myId && payload.round === round && phase === "run") fail(false);
      })
      .on("broadcast", { event: "bye" }, ({ payload }) => {
        if (payload.uid === myId || finished) return;
        phase = "bye";
        render();
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") beat(); });

    const beatTimer = setInterval(beat, BEAT_MS);
    const tick = setInterval(() => step(), 500);

    // ----- 위치 -----
    const applyPos = (p) => {
      pos = p;
      const r = geo.evaluate(p, zone);
      if (r.status !== "weak") inside = r.status === "inside";
      if (phase === "run" && inside && lap.update(p)) beat();
      drawMap();
      step();
    };
    if (!demo && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (p) => applyPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
      );
    }

    // ----- 지도: 트랙 경로, 체크포인트, 친구 위치 -----
    opts.onMapOpen?.();
    function drawMap() {
      const map = opts.map?.();
      if (!map) return;
      if (!drawMap.routed && N) {
        map.setRoute([...points, points[0]]);
        map.fit(points, 45);
        drawMap.routed = true;
      }
      if (pos) map.setMe(pos);
      const peerDone = new Set(peer && peer.round === round ? peer.visited || [] : []);
      map.setMarks?.([
        ...points.map((p, i) => ({
          lat: p.lat, lng: p.lng,
          cls: "tg-cp" + (lap.visited.includes(i) ? " mine" : "") + (peerDone.has(i) ? " theirs" : ""),
          html: `<span>${p.label || i + 1}</span>`,
        })),
        ...(peer && peer.lat != null ? [{ lat: peer.lat, lng: peer.lng, cls: "tg-peer", html: `<i></i><b>${esc(partnerName)}</b>` }] : []),
      ]);
    }

    // ----- 상태 판단 -----
    function peerOut() {
      if (!peer) return false;
      return !peer.inside || Date.now() - peer.at > STALE_MS;
    }
    function step() {
      if (finished) return;
      if (phase === "wait" && ready && peer && peer.ready && peer.round === round) {
        phase = "run";
        lap.reset();
        if (pos && inside) lap.update(pos);
        outSince = null;
        beat();
      }
      if (phase === "run") {
        const someoneOut = !inside || peerOut();
        if (someoneOut && outSince == null) outSince = Date.now();
        if (!someoneOut) outSince = null;
        if (outSince != null && Date.now() - outSince >= OUT_LIMIT_S * 1000) { fail(true); return; }
        if (lap.back && peer && peer.round === round && peer.back) { success(); return; }
      }
      render();
    }

    function fail(announce) {
      phase = "fail";
      outSince = null;
      stopWalk();
      if (announce) send("fail", { round });
      render();
    }

    function success() {
      phase = "done";
      render();
      beat();   // 친구도 확실히 성공을 알 수 있게 마지막 상태를 한 번 더
      setTimeout(() => end("done"), 1600);
    }

    function end(result) {
      if (finished) return;
      finished = true;
      clearInterval(beatTimer);
      clearInterval(tick);
      stopWalk();
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (result === "quit") send("bye");   // "leave"(화면을 나감)는 알리지 않는다 → 친구 쪽엔 연결 끊김 경고, 다시 들어오면 이어하기
      setTimeout(() => client.removeChannel(channel), 400);
      banner.remove();
      opts.map?.()?.setMarks?.([]);
      opts.map?.()?.setRoute([]);
      active = null;
      if (result !== "leave") done(result);
    }
    opts.onClear?.(() => end("leave"));   // 구역 화면을 나가면 타이머·GPS·채널 정리

    // ----- 화면 -----
    function personHtml(name, st, isMe) {
      if (!st) return `<div class="tg-name">${esc(name)}</div><div class="tg-sub">수락 기다리는 중...</div>`;
      const sameRound = isMe || st.round === round;
      const vis = sameRound ? (st.visited || []).length : 0;
      const prog = progressOf(vis, sameRound && st.back);
      const stale = !isMe && Date.now() - st.at > STALE_MS;
      const place = stale ? "📵 연결 끊김" : st.inside ? "✅ 운동장 안" : "⚠️ 운동장 밖";
      const dots = Array.from({ length: N + 1 }, (_, i) =>
        `<i class="${i < prog ? "on" : ""}">${i === N ? "🏁" : ""}</i>`).join("");
      const sub = phase === "bye" ? "" : phase === "wait" || phase === "fail"
        ? (st.ready && sameRound ? "준비 완료" : "위치 인증 전")
        : (sameRound && st.back ? "한 바퀴 완료!" : `체크포인트 ${vis}/${N}`);
      return `<div class="tg-name">${esc(name)}${isMe ? " (나)" : ""}</div>
        <div class="tg-sub">${place}</div>${sub ? `<div class="tg-sub">${sub}</div>` : ""}
        <div class="tg-dots">${dots}</div>`;
    }

    function render() {
      $c(".tg-title").innerHTML = `${josa(partnerName, "과", "와")} 대운동장 한 바퀴`;
      $c(".tg-phase").textContent = { wait: "준비", run: "진행 중", fail: "실패", done: "성공!", bye: "종료" }[phase];
      $c(".tg-phase").dataset.phase = phase;
      $c('[data-who="me"]').innerHTML = personHtml(myName, { ...myState(), at: Date.now() }, true);
      $c('[data-who="peer"]').innerHTML = personHtml(partnerName, peer, false);

      // 경고 배너 + 카운트다운
      let warn = "";
      if (phase === "run" && outSince != null) {
        const left = Math.max(0, OUT_LIMIT_S - Math.floor((Date.now() - outSince) / 1000));
        const who = !inside ? "내가" : peer && Date.now() - peer.at > STALE_MS ? `${josa(partnerName, "과", "와")} 연결이 끊겨서` : josa(partnerName, "이", "가");
        warn = !inside || !(peer && Date.now() - peer.at > STALE_MS)
          ? `⚠️ ${who} 운동장 밖으로 나갔어요! ${left}초 안에 돌아오지 않으면 미션 실패`
          : `⚠️ ${who} ${left}초 안에 다시 연결되지 않으면 미션 실패`;
      }
      banner.innerHTML = warn;
      banner.classList.toggle("show", !!warn);
      card.classList.toggle("tg-alert", !!warn);

      // 안내 문구
      const msg = $c(".tg-msg");
      if (phase === "wait") {
        msg.innerHTML = !peer ? `${josa(partnerName, "이", "가")} 수락하면 여기서 바로 이어져요.`
          : !ready ? "운동장 안에 있는지 위치 인증을 해 주세요."
          : `${esc(partnerName)}의 위치 인증을 기다리는 중...`;
      } else if (phase === "run") {
        msg.innerHTML = warn ? "얼른 운동장 안으로 돌아와 주세요!"
          : lap.back ? `나는 한 바퀴 완료! ${josa(partnerName, "이", "가")} 들어오길 기다리는 중...`
          : lap.visited.length === N ? "출발점으로 돌아가면 한 바퀴 완료!"
          : "트랙을 따라 지도의 깃발을 모두 지나가 주세요. 둘 다 한 바퀴를 돌면 성공이에요!";
      } else if (phase === "fail") {
        msg.innerHTML = "<b>미션 실패!</b> 30초 넘게 운동장 밖에 있었어요. 처음부터 다시 도전해 보세요.";
      } else if (phase === "done") {
        msg.innerHTML = "<b>둘 다 한 바퀴 완주! 🎉</b>";
      } else if (phase === "bye") {
        msg.innerHTML = `${josa(partnerName, "이", "가")} 미션을 그만뒀어요.`;
      }

      renderButtons();
    }

    let lastBtnKey = "";
    function renderButtons() {
      const btns = [];
      if (phase === "wait" && peer && !ready) btns.push(["ready", "📍 운동장 안에 있어요 (위치 인증)", "primary"]);
      if (phase === "fail") btns.push(["retry", "처음부터 다시 도전", "primary"]);
      if (demo && (phase === "run" || phase === "wait") && ready) {
        if (phase === "run" && inside && !lap.back) btns.push(["walk", walking ? "걷는 중..." : "🚶 트랙 한 바퀴 걷기 (데모)", "ghost"]);
        btns.push(inside ? ["out", "🚪 구역 밖으로 나가기 (데모)", "ghost"] : ["in", "↩️ 운동장으로 돌아오기 (데모)", "ghost"]);
      }
      if (phase === "bye") btns.push(["close", "확인", "primary"]);
      else if (phase !== "done") btns.push(["quit", "그만두기", "ghost"]);
      const key = btns.map((b) => b[0] + b[1]).join("|");
      if (key === lastBtnKey) return;   // 매 0.5초 다시 그리면 누르는 중에 버튼이 바뀌어서, 바뀔 때만
      lastBtnKey = key;
      const box = $c(".tg-btns");
      box.innerHTML = btns.map(([v, label, cls]) => `<button class="chip ${cls}" data-v="${v}" ${v === "walk" && walking ? "disabled" : ""}>${label}</button>`).join("");
      box.querySelectorAll("button").forEach((b) => (b.onclick = () => onButton(b.dataset.v, b)));
    }

    async function onButton(v, btn) {
      if (v === "ready") {
        btn.disabled = true;
        const ok = await checkInside();
        if (!ok) {
          $c(".tg-msg").innerHTML = "아직 운동장 밖이에요. 운동장(빨간 점선) 안으로 들어와서 다시 눌러 주세요.";
          btn.disabled = false;
          return;
        }
        ready = true;
        beat();
        step();
      } else if (v === "retry") {
        round++;
        phase = "wait";
        ready = false;
        lap.reset();
        if (demo) { parked = null; pos = { ...points[0], accuracy: 5 }; inside = true; drawMap(); }
        beat();
        step();
      } else if (v === "walk") walkLap();
      else if (v === "out") {
        stopWalk();
        parked = pos;
        // 운동장 중심에서 150m 북서쪽 = 구역 밖
        applyPos({ ...geo.offsetPoint({ lat: zone.lat, lng: zone.lng }, 150, 315), accuracy: 5 });
        beat();
      } else if (v === "in") {
        applyPos({ ...(parked || points[0]), accuracy: 5 });
        parked = null;
        beat();
      } else if (v === "quit" || v === "close") end("quit");
    }

    // 위치 인증: 데모는 가상 위치, 실제는 GPS 한 번 측정
    function checkInside() {
      if (demo) { if (!pos) pos = { ...points[0], accuracy: 5 }; applyPos(pos); return Promise.resolve(inside); }
      return new Promise((resolve) => {
        if (!("geolocation" in navigator)) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const r = geo.evaluate({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, zone);
            applyPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
            resolve(r.status === "inside");
          },
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    // 데모: 지금 자리에서 가까운 체크포인트부터 트랙을 따라 한 바퀴 걸어간다 (약 10초)
    function walkLap() {
      if (walking || !N) return;
      const near = points.map((p, i) => [geo.distanceM(pos || points[0], p), i]).sort((a, b) => a[0] - b[0])[0][1];
      const path = [pos || points[near]];
      for (let k = 0; k <= N; k++) path.push(points[(near + k) % N]);
      let seg = 0, t = 0;
      walking = setInterval(() => {
        t += 0.2;
        if (t >= 1) { t = 0; seg++; }
        if (seg >= path.length - 1) { stopWalk(); applyPos({ ...path[path.length - 1], accuracy: 5 }); beat(); return; }
        applyPos({ ...geo.lerp(path[seg], path[seg + 1], t), accuracy: 5 });
      }, 400);
      renderButtons();
    }
    function stopWalk() {
      if (walking) { clearInterval(walking); walking = null; lastBtnKey = ""; }
    }

    render();
    drawMap();
  });
}