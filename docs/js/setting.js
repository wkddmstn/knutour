// 관리자 페이지에서 켜고 끄는 서버 설정값들. 지금은 히든미션 on/off 하나뿐이다.
import { client } from "./supa.js";

// 테이블(hidden_mission_settings)이 아직 없거나 값이 없으면 기본적으로 "켜짐"으로 취급한다
// (admin-extra-setup.sql을 아직 안 돌렸어도 앱이 멈추지 않도록).
export async function isHiddenMissionEnabled(id) {
  try {
    const { data, error } = await client.from("hidden_mission_settings").select("enabled").eq("id", id).maybeSingle();
    if (error || !data) return true;
    return !!data.enabled;
  } catch {
    return true;
  }
}