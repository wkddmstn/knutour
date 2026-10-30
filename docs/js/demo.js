// js/demo.js — 데모(시연) 모드 스위치 (담당: 장주연)
//   켜짐: 실제 GPS 없이 "위치 이동하기 (데모)"·"데모로 걷기"·"트랙 한 바퀴 걷기 (데모)" 같은 시연용 버튼이 보인다
//   꺼짐: 실제 사용자가 보는 화면 그대로 (진짜 GPS로 위치 인증, 시연용 버튼 없음) → 시연 영상 찍을 때
// 정하는 순서 (앞에 있는 게 우선):
//   ① 주소 끝 ?demo=0 / ?demo=1                       — 그 페이지만
//   ② 이 기기 설정 (demo.html 또는 관리자 페이지에서 저장) — 그 폰·PC에서만, 서버 설정 없이 바로
//   ③ 서버 설정 (Supabase hidden_mission_settings 표의 id "demo" 줄) — 모든 사용자
//   ④ 아무것도 없으면 켜짐
import { isHiddenMissionEnabled } from "./settings.js";

export const DEVICE_KEY = "knu-demo";   // 이 기기 설정: "1" 켜짐 / "0" 꺼짐 / 없음 = 서버 설정 따름
export let DEMO = true;                 // 다른 파일에서 import { DEMO } 하면 불러온 뒤의 값이 그대로 보인다

export async function loadDemo() {
  const q = new URLSearchParams(location.search).get("demo");
  if (q === "0" || q === "1") { DEMO = q === "1"; return DEMO; }
  let dev = null;
  try { dev = localStorage.getItem(DEVICE_KEY); } catch {}
  if (dev === "0" || dev === "1") { DEMO = dev === "1"; return DEMO; }
  try { DEMO = await isHiddenMissionEnabled("demo"); } catch { DEMO = true; }
  return DEMO;
}
