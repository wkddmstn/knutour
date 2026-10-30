// js/demo.js — 데모(시연) 모드 스위치 (담당: 장주연)
// 관리자 페이지 "🎬 데모 모드"에서 켜고 끈다. (Supabase hidden_mission_settings 표의 id "demo" 줄을 같이 쓴다)
//   켜짐: 실제 GPS 없이 "위치 이동하기 (데모)"·"데모로 걷기"·"트랙 한 바퀴 걷기 (데모)" 같은 시연용 버튼이 보인다
//   꺼짐: 실제 사용자가 보는 화면 그대로 (진짜 GPS로 위치 인증, 시연용 버튼 없음) → 시연 영상 찍을 때
// 줄이 아직 없거나 못 읽으면 "켜짐"으로 본다. 주소 끝 ?demo=0 / ?demo=1 로 이 기기에서만 잠깐 바꿔 볼 수도 있다.
import { isHiddenMissionEnabled } from "./settings.js";

export let DEMO = true;   // 다른 파일에서 import { DEMO } 하면 불러온 뒤의 값이 그대로 보인다

export async function loadDemo() {
  const q = new URLSearchParams(location.search).get("demo");
  if (q === "0" || q === "1") { DEMO = q === "1"; return DEMO; }
  try { DEMO = await isHiddenMissionEnabled("demo"); } catch { DEMO = true; }
  return DEMO;
}
