// js/themes.js — 테마(시즌) 관리
// data/themes.json의 테마 목록 + 관리자가 Supabase(theme_settings)에 저장한 날짜·기본 테마를 합쳐서
// "오늘 적용할 테마"를 정한다.
//
//   오늘(한국 시간)이 어느 테마의 시작일~종료일 안이면 → 그 테마
//   어느 테마 기간에도 안 들어가면                     → 관리자가 정한 기본 테마 (없으면 themes.json의 defaultTheme)
//
// 테스트용 주소 옵션: ?theme=cherry (테마 강제), ?today=2027-04-01 (오늘 날짜 바꾸기)

import { client } from "./supa.js";

const params = new URLSearchParams(location.search);

// 한국 시간 기준 오늘 날짜 "YYYY-MM-DD"
export function todayKST() {
  const forced = params.get("today");
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

let state = { themes: [], current: null, defaultId: null, reason: "" };

// 앱 시작할 때 한 번. Supabase가 안 되면 themes.json 날짜만으로 정한다.
export async function loadThemes() {
  const raw = await (await fetch("data/themes.json")).json();
  const themes = raw.themes.map((t) => ({ ...t, special: t.special || [] }));
  let defaultId = raw.defaultTheme || themes[0]?.id;
  try {
    const { data, error } = await client.from("theme_settings").select("id, start_date, end_date, is_default");
    if (!error && data) {
      for (const row of data) {
        const t = themes.find((x) => x.id === row.id);
        if (!t) continue;
        if (row.start_date) t.start = row.start_date;
        if (row.end_date) t.end = row.end_date;
        if (row.is_default) defaultId = row.id;
      }
    }
  } catch { /* 설정 표가 아직 없으면 기본값으로 */ }

  const today = todayKST();
  const forced = themes.find((t) => t.id === params.get("theme"));
  const byDate = themes.find((t) => t.start && t.end && t.start <= today && today <= t.end);
  const fallback = themes.find((t) => t.id === defaultId) || themes[0];
  const current = forced || byDate || fallback;
  state = {
    themes, defaultId, current,
    reason: forced ? "forced" : byDate ? "date" : "default",   // 왜 이 테마인지 (화면 안내용)
  };
  return state;
}

export const getThemes = () => state.themes;
export const currentTheme = () => state.current;
export const themeReason = () => state.reason;

// 이 미션이 지금 테마에 포함되는지
export const inTheme = (missionId, theme = state.current) => !!theme && theme.missions.includes(missionId);

// 이 미션이 들어 있는 테마 (잠긴 장소에 "○○에 열려요" 안내할 때)
export const themeOfMission = (missionId) => state.themes.find((t) => t.missions.includes(missionId)) || null;

// 장소 목록을 지금 테마 기준으로 나눈다.
//   active: 지금 테마 미션이 하나라도 있는 장소 (미션도 지금 테마 것만 남김)
//   locked: 그 밖의 장소 (다른 테마에서 열림)
export function splitZones(allZones, theme = state.current) {
  const active = [], locked = [];
  for (const z of allZones) {
    const missions = z.missions.filter((m) => inTheme(m.id, theme));
    if (missions.length) active.push({ ...z, missions });
    else {
      const other = z.missions.map((m) => themeOfMission(m.id)).find(Boolean);
      locked.push({ ...z, openTheme: other || null });
    }
  }
  return { active, locked };
}

// 오늘 뜨는 특별 미션 (예: 만우절 교복 사진, date "04-01")
export function todaysSpecials(theme = state.current) {
  if (!theme) return [];
  const mmdd = todayKST().slice(5);
  return theme.special.filter((s) => s.date === mmdd);
}

// "3월 2일 ~ 3월 8일" 같은 기간 표시
export function periodText(t) {
  if (!t?.start || !t?.end) return "";
  const f = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
  return `${f(t.start)} ~ ${f(t.end)}`;
}