// 랭킹 데이터 계층.
// profiles.score(실시간으로 동기화된 진짜 참가자 점수)를 기준으로 실제 랭킹을 보여준다.
// (예전엔 더미 참가자 + 내 점수만 섞은 가짜였는데, 이제 서버 점수를 그대로 쓴다.)
import { getState } from "./storage.js";
import { client, getCachedProfile } from "./supa.js";

// mode: "theme"(이번 테마 미션 점수, missionIds 필요) | "total"(개인) | "dept"(소속별 평균)
export async function getRanking(mode = "total", missionIds = []) {
  const meId = getCachedProfile()?.id;
  if (mode === "theme") return getThemeRanking(meId, missionIds);
  const { data, error } = await client
    .from("profiles")
    .select("id, nickname, dept, score")
    .order("score", { ascending: false })
    .limit(300);

  const rows = (error || !data) ? [] : data.map((p) => ({ ...p }));

  // 막 완료한 직후처럼 서버 동기화가 아직 안 끝났을 수 있으니, 내 최신 로컬 점수로 보정한다
  const st = getState();
  const mine = rows.find((p) => p.id === meId);
  if (mine) {
    mine.score = Math.max(mine.score, st.score);
  } else if (meId && st.profile) {
    rows.push({ id: meId, nickname: st.profile.nickname, dept: st.profile.dept, score: st.score });
  }

  if (mode === "dept") {
    const groups = new Map();
    rows.forEach((p) => {
      const g = groups.get(p.dept) || { name: p.dept, sum: 0, count: 0, me: false };
      g.sum += p.score;
      g.count += 1;
      if (p.id === meId) g.me = true;
      groups.set(p.dept, g);
    });
    return [...groups.values()]
      .map((g) => ({ name: g.name, sub: `${g.count}명 참여 · 평균`, score: Math.round(g.sum / g.count), me: g.me }))
      .sort((a, b) => b.score - a.score);
  }

  // 동점이면 나를 위로 (내가 방금 깬 걸 바로 체감할 수 있게)
  return rows
    .sort((a, b) => b.score - a.score || (a.id === meId ? -1 : 1))
    .map((p) => ({ name: p.nickname, sub: p.dept, score: p.score, me: p.id === meId }));
}
// 이번 테마 랭킹: 테마 미션(mission_completions)으로 얻은 점수 합계 (supabase/themes.sql의 theme_ranking)
async function getThemeRanking(meId, missionIds) {
  const { data, error } = await client.rpc("theme_ranking", { p_missions: missionIds });
  const rows = (error || !data) ? [] : data.map((p) => ({ ...p, score: Number(p.score) || 0 }));
  // 방금 깬 미션이 아직 서버에 반영 전일 수 있으니 내 점수는 이 기기 기록으로 보정
  const st = getState();
  const local = missionIds.reduce((sum, id) => sum + (st.done[id]?.pts || 0), 0);
  const mine = rows.find((p) => p.id === meId);
  if (mine) mine.score = Math.max(mine.score, local);
  else if (meId && st.profile && local > 0) rows.push({ id: meId, nickname: st.profile.nickname, dept: st.profile.dept, score: local });
  return rows
    .sort((a, b) => b.score - a.score || (a.id === meId ? -1 : 1))
    .map((p) => ({ name: p.nickname, sub: p.dept, score: p.score, me: p.id === meId }));
}