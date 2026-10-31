// js/tour.js — 호반우와 캠퍼스 투어 (담당: 장주연)
// 흐름: 홈 탭 "투어" 카드 → 코스 고르기 → [이동 화면: 지도·화살표·호반우 음성 안내] → 도착 →
//       기존 구역 채팅(미션)으로 연결 → 미션 메뉴/구역 클리어에서 "다음 장소로 (투어)" → 다시 이동 화면 → … → 완주
// main.js는 이 파일을 "있으면 쓰는" 방식(동적 import + try/catch)으로 불러온다.
// 그래서 이 파일에 문제가 생겨도 기존 앱(구역 채팅·미션·AR)은 그대로 동작한다.
import * as geo from "./geo.js";
import { confirmDialog } from "./dialog.js";
import { MASCOTS, setHobanuPaneExtra, startAR, openPhotoStudio } from "./ar.js";
import * as bgm from "./tour-bgm.js";
import { icon } from "./icons.js";   // 코스 고르기 시트: 장소 목록과 같은 젤리 아이콘   // 안내 음성이 없을 때 깔리는 배경 음악 (말할 땐 작아짐)
import { currentTheme } from "./themes.js";
import { CampusMap, campusDataReady } from "./campusmap.js";   // 미션 화면과 같은 지도

export const TOUR_ON = true;          // false로 바꾸면 투어 카드/버튼이 전부 사라진다
import { DEMO } from "./demo.js";      // 시연용 "데모로 걷기" 버튼은 관리자 페이지 "데모 모드"가 켜졌을 때만
const DEBUG = new URLSearchParams(location.search).get("debug") === "1";   // ?debug=1 : 지도를 누르면 좌표 표시
const KEY = "knu-tour-v1";
const BADGE_KEY = "knu-tour-badges";      // { courseId: 받은 시각 }
const VOICE_KEY = "knu-tour-voice";

// 출발 위치. 정문 좌표는 맛집 데이터(data/restaurants.json gates)의 카카오맵 정문 위치와 같다 (장주연)
// 예전 값(35.8893, 128.6157)은 동문 근처로 잘못 찍혀 있었다. 틀리면 ?debug=1 로 지도를 눌러 좌표를 찾아 바꾸기
const GATES = {
  main: { id: "gate-main", name: "정문", lat: 35.885506, lng: 128.614497 },
  // north: { id: "gate-north", name: "북문", lat: 0, lng: 0 },   // 북문은 나중에 추가
};

const COURSES = [
  { id: "godsaeng", name: "갓생 코스", emoji: "📚", badge: "갓생 새내기", img: "img/mascot/exam.png", desc: "공부·생활에 꼭 필요한 곳만 쏙쏙", icon: "library",
    stops: ["centralpark", "bokji", "loveroad", "ilcheongdam", "library"] },   // 정문 바로 옆 센팍부터 (장주연)
  { id: "healing", name: "힐링 코스", emoji: "🌸", badge: "힐링 마스터", img: "img/mascot/no-plastic.png", desc: "맛있는 학식 먹고 산책하며 쉬어 가기", icon: "cherryroad",
    stops: ["loveroad", "ilcheongdam", "gongstaurant", "cherryroad", "stadium"] },
  { id: "full", name: "전체 코스", emoji: "🗺️", badge: "캠퍼스 정복자", img: "img/mascot/badge-campus.png", desc: "캠퍼스 한 바퀴 완주", icon: "pin",
    stops: ["centralpark", "bokji", "loveroad", "library", "ilcheongdam", "gongstaurant", "cherryroad", "stadium"] },
];

// 도착했을 때 호반우가 읽어 주는 장소 소개 (zones.json 소개 문구 바탕)
const INTRO = {
  loveroad: "여기는 러브로드야. 연인이 손을 잡고 정문에서 본관 방향으로 걸으면 영원한 사랑이 이루어진다는 전설이 있어. 친구랑 같이 걸어도 좋아!",
  ilcheongdam: "여기는 일청담이야. 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 밤이 되면 호롱불이 켜지고, 가끔 신천에 사는 수달도 놀러 온대!",
  library: "여기는 중앙도서관이야. 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있어.",
  bokji: "여기는 복지관이야. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 곳이 모여 있어. 개강 준비물은 여기서 챙기면 돼!",
  centralpark: "여기는 센트럴파크, 줄여서 센팍이야. 영화를 상영하는 무빔이 열리는 잔디밭이야. 돗자리 펴고 피크닉 하기 딱 좋아!",
  gongstaurant: "여기는 공식당이야. 공대생들에게 인기 있는 학식당인데, 치즈알밥이랑 육회비빔밥이 특히 맛있어. 개강 시즌엔 사람이 많으니까 일찍 와야 해!",
  cherryroad: "여기는 벚꽃길이야. 봄이 되면 벚꽃 잎이 눈처럼 흩날리는 산책로야. 여기서 찍으면 인생샷 보장!",
  stadium: "여기는 대운동장이야. 축제 무대가 열리는 곳이고, 바로 옆 백호관에는 중앙동아리방이 모여 있어. 올해 축제엔 누가 올까?",
};
// 가는 길 절반쯤에서 들려주는 이야기 (다음 장소 미리 보기)
const HALF = {
  loveroad: "지금 걷는 이 길이 백양로야. 정문에서 본관 쪽으로 쭉 이어져.",
  ilcheongdam: "일청담은 감꽃 모양 연못이야. 물가에 수달이 있나 잘 봐 봐!",
  library: "도서관 자리는 앱으로 미리 예약할 수 있어. 꼭 깔아 둬!",
  bokji: "복지관엔 서점이랑 우체국도 있어. 교재 살 때 들러 봐!",
  centralpark: "센팍에선 무빔 영화도 상영해. 날 좋은 날 꼭 와 봐!",
  gongstaurant: "공식당 메뉴는 매일 바뀌어. 인스타나 크누피아에서 볼 수 있어!",
  cherryroad: "벚꽃길은 공식당이랑 아주 가까워. 금방 도착해!",
  stadium: "작년 축제엔 지코랑 선미도 왔대. 조금만 더 가자!",
};
// 가는 길 건물 이야기 (좌표를 알게 되면 여기에 추가 → 35m 안에 들어오면 한 번 말해 줌)
// 예) { name: "본관", lat: 35.889, lng: 128.612, line: "오른쪽에 보이는 큰 건물이 본관이야!" }
const POIS = [];

/* ---------------- 앱과 연결 ---------------- */
let app = null;   // { zones(), openZone, goTab, store, ui }
export function initTour(api) {
  app = api;
  try { setHobanuPaneExtra(renderBadgeSection); } catch {}   // 도감 탭에 투어 뱃지 칸
}
const zoneById = (id) => app?.zones().find((z) => z.id === id);
// 받침에 따라 "이야/야", "으로/로" 붙이기
const hasBatchim = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
const iya = (w) => w + (hasBatchim(w) ? "이야" : "야");
const course = (id) => COURSES.find((c) => c.id === id);

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(st) { try { st ? localStorage.setItem(KEY, JSON.stringify(st)) : localStorage.removeItem(KEY); } catch {} }
export const isActive = () => TOUR_ON && !!load();
const curStopId = () => { const st = load(); return st ? course(st.course)?.stops[st.idx] : null; };
const getBadges = () => { try { return JSON.parse(localStorage.getItem(BADGE_KEY)) || {}; } catch { return {}; } };
function giveBadge(id) {
  const b = getBadges();
  if (b[id]) return false;
  b[id] = Date.now();
  try { localStorage.setItem(BADGE_KEY, JSON.stringify(b)); } catch {}
  return true;
}
const fmtDay = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
// 호반우 그림 뱃지 (받기 전에는 실루엣)
const badgeHtml = (c, on, big = false) => `<div class="tb-badge ${on ? "on" : ""} ${big ? "big" : ""}" data-c="${c.id}">
  <div class="tb-medal"><img src="${c.img}" alt="${c.badge}">${on ? "" : "<em>?</em>"}</div>
  <b>${on ? c.badge : "???"}</b><span>${on ? fmtDay(on) + " 획득" : c.name + " 완주 시"}</span></div>`;
// 도감 탭의 "투어 뱃지" 칸 (ar.js의 도감 대표 카드 아래에 붙음)
function renderBadgeSection(slot) {
  if (!TOUR_ON || !slot) return;
  injectStyle();
  const got = getBadges();
  slot.innerHTML = `<div class="dex-inline tb-section">
    <div class="dex-head"><b>🏅 투어 뱃지</b><span>${Object.keys(got).length} / ${COURSES.length}</span></div>
    <p class="dex-sub">호반우와 투어 코스를 완주하면 호반우 뱃지를 받아요!</p>
    <div class="tb-badges">${COURSES.map((c) => badgeHtml(c, got[c.id])).join("")}</div></div>`;
  slot.querySelectorAll(".tb-badge:not(.on)").forEach((el) => (el.onclick = () => {
    const c = course(el.dataset.c);
    app?.ui?.toast?.(`${c.emoji} ${c.name}를 완주하면 받을 수 있어요`);
  }));
}

/* ---------------- 음성: 녹음 파일(타입캐스트) 우선, 없으면 브라우저 내장 TTS ---------------- */
// 대사 (audio/tour/{키}.mp3). 말풍선 글자도 녹음과 똑같이 보여 준다. 음성: 타입캐스트 "개나리"(경상도 사투리)
// 대사를 바꾸면 tools/make_voice.py 의 LINES도 똑같이 바꾸고 다시 실행해서 mp3를 새로 만든다
// 개나리: 경상도 사투리 대사
const SCRIPT_DIALECT = {
  "start-godsaeng": "안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 갓생 코스 같이 돌 끼다. 공부하고 생활하는 데 꼭 필요한 데만 쏙쏙 골라 놨데이! 첫 번째는 정문 바로 옆 센트럴파크다. 화살표 따라 퍼뜩 출발하자!",
  "start-healing": "안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 힐링 코스 같이 돌 끼다. 맛있는 학식 묵고, 벚꽃길 산책하믄서 쉬엄쉬엄 가는 코스데이! 첫 번째는 러브로드다. 화살표 따라 출발하자!",
  "start-full": "안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 전체 코스 같이 돌 끼다. 캠퍼스 여덟 군데를 한 바퀴 다 도는 기라 쫌 길데이. 물 한 병 챙깄나? 첫 번째는 정문 바로 옆 센트럴파크다. 출발하자!",
  "next-ilcheongdam": "다음은 일청담이다! 밤 되믄 호롱불 켜지는 억수로 예쁜 연못이데이. 경북대 오믄 다들 한 번씩 사진 찍고 가는 데 아이가. 지도 따라 같이 가 보자!",
  "next-library": "다음은 중앙도서관이다! 전국 대학 도서관 중에 두 번째로 책이 많은 데다. 시험 기간 되믄 여기가 니 두 번째 집 될 끼다. 같이 가 보자!",
  "next-bokji": "다음은 복지관이다! 서점, 은행, 우체국까지 학교생활에 필요한 기 다 모여 있데이. 교재 사고 택배 부칠 때 여기만 오믄 된다. 같이 가 보자!",
  "next-centralpark": "다음은 센트럴파크다! 다들 줄여가 센팍이라 칸다. 무빔 영화 하는 넓은 잔디밭이라 쉬다 가기 딱 좋데이. 같이 가 보자!",
  "next-gongstaurant": "다음은 공식당이다! 공대생들이 억수로 좋아하는 학식 맛집이데이. 배고프믄 힘이 안 나니까, 오늘 메뉴 뭐 있는지 같이 보러 가자!",
  "next-cherryroad": "다음은 벚꽃길이다! 봄 되믄 벚꽃잎이 눈처럼 흩날리는 산책로데이. 공식당에서 억수로 가까버가 금방 도착할 끼다. 같이 가 보자!",
  "next-stadium": "다음은 대운동장이다! 축제 무대 열리는 데 아이가. 바로 옆 백호관에 중앙동아리방이 모여 있어가 동아리 구경도 할 수 있데이. 마지막까지 힘내가 가 보자!",
  "next-loveroad": "다음은 러브로드다! 손잡고 걸으믄 사랑이 이뤄진다 카는 전설이 있는 길이데이. 옆에 친구 손 한번 잡아 볼래? 같이 가 보자!",
  "way-gate-loveroad": "드디어 캠퍼스 안에 들어왔데이! 처음엔 길이 다 비슷비슷해 보이제? 내만 따라오믄 금방 익숙해질 끼다. 천천히 같이 걸어 보자!",
  "way-loveroad-ilcheongdam": "저기 보이는 웅장한 돌 건물이 본관이다. 1960년에 지었는데, 불국사 계단하고 석굴암 돔을 본떠가 만들었다 카더라. 총장실도 저 안에 있데이!",
  "way-ilcheongdam-library": "가는 길에 빨간 벽돌 건물 보이제? 입학식하고 졸업식 하는 대강당이다. 천팔백 명 넘게 들어가는 큰 공연장이라 공연도 자주 한데이.",
  "way-library-ilcheongdam": "이 길로 쭉 가믄 일청담 나온데이. 도서관에서 공부하다가 머리 식히러 산책 가기 딱 좋은 거리다. 가는 길에 대강당도 있으니까 단디 봐라!",
  "way-library-bokji": "저짝에 높이 솟은 건물 보이제? 17층짜리 글로벌플라자다. 국제회의장도 있고, 경북대 역사 전시관도 있데이.",
  "way-bokji-library": "도서관 가는 길이다. 열람실 자리는 도서관 앱으로 미리 잡을 수 있으니까, 걸으믄서 앱 하나 깔아 두는 기 어떻노?",
  "way-bokji-centralpark": "복지관에서 센팍까지는 금방이데이. 복지관에서 간식 사 들고 센팍 잔디밭에 앉아가 쉬는 것도 꿀팁이다!",
  "way-centralpark-bokji": "인자 복지관 가자. 학기 초에는 교재 사러 서점에 사람이 억수로 몰리니까, 미리 위치 알아 두믄 편하데이!",
  "way-loveroad-centralpark": "센팍 가는 길이다. 날 좋은 날엔 잔디밭에 돗자리 펴고 쉬는 학생들이 억수로 많데이. 우리도 담에 피크닉 하러 오자!",
  "way-ilcheongdam-gongstaurant": "이짝으로 가믄 공대 건물들이 모여 있데이. 그래서 이 근처 학식당 이름이 공식당이다. 공대 식당, 줄여가 공식당 아이가!",
  "way-gongstaurant-cherryroad": "배 든든하게 채웠나? 인자 소화도 시킬 겸 천천히 걸어 보자. 벚꽃길은 바로 코앞이데이!",
  "way-cherryroad-stadium": "대운동장 가는 길은 쫌 걸어야 된데이. 축제 때는 이 길이 사람으로 꽉 차가 걷기도 힘들 정도라 카더라. 지금은 여유롭게 걸어 보자!",
  "half-loveroad": "지금 걷는 이 길이 백양로다. 정문에서 본관 쪽으로 쭉 이어지는 경북대 메인 길이데이. 봄 되믄 길가에 꽃이 펴가 더 예쁘다!",
  "half-ilcheongdam": "일청담은 경북대 상징인 감꽃 모양을 본떠가 만든 연못이다. 물가에 수달 있나 단디 봐라! 운 좋으믄 만날 수도 있데이.",
  "half-library": "도서관 자리는 앱으로 미리 예약할 수 있데이. 시험 기간엔 자리가 퍼뜩 차니까 꼭 깔아 둬라! 열람실은 신관, 책은 구관이다.",
  "half-bokji": "복지관엔 서점하고 은행, 우체국도 있데이. 교재 살 때나 택배 부칠 때 들르믄 된다. 거의 다 왔다!",
  "half-centralpark": "센팍에서는 무빔이라고, 밖에서 영화 틀어 주는 행사도 한데이. 날 좋은 날 친구랑 돗자리 들고 꼭 와 봐라!",
  "half-gongstaurant": "공식당 메뉴는 매일 바뀐데이. 인스타나 크누피아에서 미리 볼 수 있다! 오늘 메뉴는 뭐겠노? 벌써 배고프다.",
  "half-cherryroad": "벚꽃길은 공식당이랑 억수로 가깝데이. 봄에 오믄 꽃잎이 바람에 흩날리가 진짜 예쁘다. 금방 도착한데이!",
  "half-stadium": "작년 축제엔 지코랑 선미도 왔다 카더라. 올해는 누가 올지 벌써 궁금하네! 쫌만 더 가자!",
  "intro-loveroad": "도착! 여기가 러브로드다. 연인이 손잡고 정문에서 본관 쪽으로 걸으믄 영원한 사랑이 이뤄진다 카는 전설이 있데이. 친구랑 같이 걸어도 좋다! 여기서 사진 한 장 남기고 갈래?",
  "intro-ilcheongdam": "도착! 여기가 일청담이다. 경북대 상징인 감꽃 모양을 본떠가 만든 연못이데이. 밤 되믄 호롱불 켜지고, 가끔 신천에 사는 수달도 놀러 온다 카더라! 물가 벤치에 앉아가 잠깐 쉬다 가도 된다.",
  "intro-library": "도착! 여기가 중앙도서관이다. 전국 대학 도서관 중에 두 번째로 책이 많은 데다. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있데이. 안에서는 조용히 해야 되니까 우리 목소리 쫌 낮추자, 쉿!",
  "intro-bokji": "도착! 여기가 복지관이다. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 기 다 모여 있데이. 개강 준비물은 여기서 챙기믄 된다! 공강 시간에 들르기 딱 좋은 데다.",
  "intro-centralpark": "도착! 여기가 센트럴파크, 줄여가 센팍이다. 영화 틀어 주는 무빔이 열리는 잔디밭이데이. 돗자리 펴고 피크닉 하기 딱 좋다! 잔디에 잠깐 앉아가 다리 쫌 쉬다 가자.",
  "intro-gongstaurant": "도착! 여기가 공식당이다. 공대생들한테 인기 많은 학식당인데, 치즈알밥하고 육회비빔밥이 억수로 맛있데이. 개강 시즌엔 사람 많으니까 일찍 와야 된다! 배고프믄 여기서 밥 묵고 가자.",
  "intro-cherryroad": "도착! 여기가 벚꽃길이다. 봄 되믄 벚꽃잎이 눈처럼 흩날리는 산책로데이. 여기서 찍으믄 인생샷 보장이다! 꽃잎 떨어질 때 맞춰가 찍으믄 더 예쁘데이.",
  "intro-stadium": "도착! 여기가 대운동장이다. 축제 무대 열리는 데고, 바로 옆 백호관에는 중앙동아리방이 모여 있데이. 올해 축제엔 누가 오겠노? 축제 때 여기 꽉 찬 거 꼭 보러 온나!",
  "near": "거의 다 왔데이! 저 앞이다! 쫌만 더 힘내라!",
  "wrong": "어, 반대쪽 같은데? 화살표 가리키는 쪽으로 다시 가 봐라. 길 잃어도 내 있으니까 걱정 마래이!",
  "far": "아직 쫌 멀다! 화살표 따라 쫌만 더 가 봐라. 빨간 데 안에 들어오믄 도착이데이!",
  "halfway": "벌써 반이나 왔데이! 이 속도믄 금방 도착하겠다.",
  "finish-godsaeng": "갓생 코스 완주다! 갓생 새내기 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!",
  "finish-healing": "힐링 코스 완주다! 힐링 마스터 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!",
  "finish-full": "전체 코스 완주다! 캠퍼스 정복자 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!",
};
// 몽실이: 표준어 대사 (키는 위와 똑같음)
const SCRIPT_STD = {
  "start-godsaeng": "안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 갓생 코스를 같이 돌 거야. 공부하고 생활하는 데 꼭 필요한 곳만 쏙쏙 골랐어! 첫 번째 장소는 정문 바로 옆 센트럴파크야. 화살표 따라 출발하자!",
  "start-healing": "안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 힐링 코스를 같이 돌 거야. 맛있는 학식 먹고, 벚꽃길 산책하면서 쉬어 가는 코스야! 첫 번째 장소는 러브로드야. 화살표 따라 출발하자!",
  "start-full": "안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 전체 코스를 같이 돌 거야. 캠퍼스 여덟 곳을 한 바퀴 다 도는 코스라 조금 길어. 물 한 병 챙겼지? 첫 번째 장소는 정문 바로 옆 센트럴파크야. 출발하자!",
  "next-ilcheongdam": "다음은 일청담! 밤에 호롱불이 켜지는 예쁜 연못이야. 경북대에 오면 다들 한 번씩 사진 찍고 가는 곳이지. 지도 따라 같이 가 보자!",
  "next-library": "다음은 중앙도서관! 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 시험 기간엔 여기가 제2의 집이 될걸? 같이 가 보자!",
  "next-bokji": "다음은 복지관! 서점, 은행, 우체국까지 학교생활에 필요한 곳이 다 모여 있어. 교재 사고 택배 보낼 때 여기만 오면 돼. 같이 가 보자!",
  "next-centralpark": "다음은 센트럴파크! 다들 줄여서 센팍이라고 불러. 무빔 영화가 열리는 넓은 잔디밭이라 쉬어 가기 딱 좋아. 같이 가 보자!",
  "next-gongstaurant": "다음은 공식당! 공대생들이 사랑하는 학식 맛집이야. 배고프면 힘이 안 나니까, 오늘 메뉴 뭐 있는지 같이 보러 가자!",
  "next-cherryroad": "다음은 벚꽃길! 봄이면 벚꽃잎이 눈처럼 흩날리는 산책로야. 공식당에서 아주 가까우니까 금방 도착할 거야. 같이 가 보자!",
  "next-stadium": "다음은 대운동장! 축제 무대가 열리는 곳이야. 바로 옆 백호관에는 중앙동아리방이 모여 있어서 동아리 구경도 할 수 있어. 마지막까지 힘내서 가 보자!",
  "next-loveroad": "다음은 러브로드! 손잡고 걸으면 사랑이 이루어진다는 전설이 있는 길이야. 옆에 있는 친구 손 한번 잡아 볼래? 같이 가 보자!",
  "way-gate-loveroad": "드디어 캠퍼스 안으로 들어왔어! 처음엔 길이 다 비슷해 보이지만, 나만 따라오면 금방 익숙해질 거야. 천천히 같이 걸어 보자!",
  "way-loveroad-ilcheongdam": "저기 보이는 웅장한 돌 건물이 본관이야. 1960년에 지어졌는데, 불국사 계단이랑 석굴암 돔을 본떠서 만들었대. 총장실도 저 안에 있어!",
  "way-ilcheongdam-library": "가는 길에 빨간 벽돌 건물 보여? 입학식이랑 졸업식이 열리는 대강당이야. 천팔백 명 넘게 들어가는 큰 공연장이라 공연도 자주 열려.",
  "way-library-ilcheongdam": "이 길로 쭉 가면 일청담이 나와. 도서관에서 공부하다 머리 식히러 산책 오기 딱 좋은 거리야. 가는 길에 대강당도 있으니까 잘 봐 봐!",
  "way-library-bokji": "저쪽에 높게 솟은 건물 보여? 17층짜리 글로벌플라자야. 국제회의장도 있고, 경북대 역사 전시관도 있어.",
  "way-bokji-library": "도서관 가는 길이야. 열람실 자리는 도서관 앱으로 미리 잡을 수 있으니까, 걸으면서 앱 하나 깔아 두는 거 어때?",
  "way-bokji-centralpark": "복지관에서 센팍까지는 금방이야. 복지관에서 간식 사 들고 센팍 잔디밭에 앉아 쉬는 것도 꿀팁이야!",
  "way-centralpark-bokji": "이제 복지관으로 가자. 학기 초에는 교재 사러 서점에 사람이 엄청 몰리니까, 미리 위치를 알아 두면 편해!",
  "way-loveroad-centralpark": "센팍 가는 길이야. 날 좋은 날엔 잔디밭에 돗자리 펴고 쉬는 학생들이 정말 많아. 우리도 나중에 피크닉 하러 오자!",
  "way-ilcheongdam-gongstaurant": "이쪽으로 가면 공대 건물들이 모여 있어. 그래서 이 근처 학식당 이름이 공식당이야. 공대 식당, 줄여서 공식당!",
  "way-gongstaurant-cherryroad": "배 든든하게 채웠지? 이제 소화도 시킬 겸 천천히 걸어 보자. 벚꽃길은 바로 코앞이야!",
  "way-cherryroad-stadium": "대운동장 가는 길은 조금 걸어야 해. 축제 땐 이 길이 사람으로 꽉 차서 걷기도 힘들 정도래. 지금은 여유롭게 걸어 보자!",
  "half-loveroad": "지금 걷는 이 길이 백양로야. 정문에서 본관 쪽으로 쭉 이어지는 경북대의 메인 길이지. 봄에는 길가에 꽃이 펴서 더 예뻐!",
  "half-ilcheongdam": "일청담은 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 물가에 수달이 있나 잘 봐 봐! 운 좋으면 만날 수도 있어.",
  "half-library": "도서관 자리는 앱으로 미리 예약할 수 있어. 시험 기간엔 자리가 금방 차니까 꼭 깔아 둬! 열람실은 신관, 책은 구관이야.",
  "half-bokji": "복지관엔 서점이랑 은행, 우체국도 있어. 교재 살 때나 택배 보낼 때 들르면 돼. 거의 다 왔어!",
  "half-centralpark": "센팍에선 무빔이라고, 야외에서 영화를 틀어 주는 행사도 열려. 날 좋은 날 친구랑 돗자리 들고 꼭 와 봐!",
  "half-gongstaurant": "공식당 메뉴는 매일 바뀌어. 인스타나 크누피아에서 미리 볼 수 있어! 오늘 메뉴는 뭘까? 벌써 배고프다.",
  "half-cherryroad": "벚꽃길은 공식당이랑 아주 가까워. 봄에 오면 꽃잎이 바람에 흩날려서 진짜 예뻐. 금방 도착해!",
  "half-stadium": "작년 축제엔 지코랑 선미도 왔대. 올해는 누가 올지 벌써 궁금하다! 조금만 더 가자!",
  "intro-loveroad": "도착! 여기는 러브로드야. 연인이 손을 잡고 정문에서 본관 방향으로 걸으면 영원한 사랑이 이루어진다는 전설이 있어. 친구랑 같이 걸어도 좋아! 여기서 사진 한 장 남겨 볼래?",
  "intro-ilcheongdam": "도착! 여기는 일청담이야. 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 밤이 되면 호롱불이 켜지고, 가끔 신천에 사는 수달도 놀러 온대! 물가 벤치에 앉아서 잠깐 쉬어 가도 좋아.",
  "intro-library": "도착! 여기는 중앙도서관이야. 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있어. 안에서는 조용히 해야 하니까 우리 목소리 낮추자, 쉿!",
  "intro-bokji": "도착! 여기는 복지관이야. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 곳이 모여 있어. 개강 준비물은 여기서 챙기면 돼! 공강 시간에 들르기 딱 좋은 곳이야.",
  "intro-centralpark": "도착! 여기는 센트럴파크, 줄여서 센팍이야. 영화를 상영하는 무빔이 열리는 잔디밭이야. 돗자리 펴고 피크닉 하기 딱 좋아! 잔디에 잠깐 앉아서 다리 좀 쉬어 가자.",
  "intro-gongstaurant": "도착! 여기는 공식당이야. 공대생들에게 인기 있는 학식당인데, 치즈알밥이랑 육회비빔밥이 특히 맛있어. 개강 시즌엔 사람이 많으니까 일찍 와야 해! 배고프면 여기서 밥 먹고 가자.",
  "intro-cherryroad": "도착! 여기는 벚꽃길이야. 봄이 되면 벚꽃 잎이 눈처럼 흩날리는 산책로야. 여기서 찍으면 인생샷 보장! 꽃잎이 떨어질 때 맞춰서 찍으면 더 예뻐.",
  "intro-stadium": "도착! 여기는 대운동장이야. 축제 무대가 열리는 곳이고, 바로 옆 백호관에는 중앙동아리방이 모여 있어. 올해 축제엔 누가 올까? 축제 때 여기 꽉 찬 모습 꼭 보러 와!",
  "near": "거의 다 왔어! 저 앞이야! 조금만 더 힘내!",
  "wrong": "어, 반대쪽 같아! 화살표가 가리키는 방향으로 다시 가 줘. 길 잃어도 내가 있으니까 걱정 마!",
  "far": "아직 좀 멀어! 화살표를 따라 조금만 더 가 줘. 빨간 영역 안에 들어오면 도착이야!",
  "halfway": "벌써 반이나 왔어! 이 속도면 금방 도착하겠다.",
  "finish-godsaeng": "갓생 코스 완주! 갓생 새내기 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!",
  "finish-healing": "힐링 코스 완주! 힐링 마스터 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!",
  "finish-full": "전체 코스 완주! 캠퍼스 정복자 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!",
};
// 지금 고른 목소리의 대사 (SCRIPT[키]로 쓰면 알아서 개나리=사투리, 몽실이=표준어)
const SCRIPT = new Proxy({}, { get: (_, k) => (voicePick() === "mongsil" ? SCRIPT_STD : SCRIPT_DIALECT)[k] });
// 호반우 목소리 고르기 (장주연): 개나리(기본, 경상도 사투리) / 몽실이(표준어). 파일은 tools/make_voice.py 로 만든다
const VOICES = { gaenari: { name: "사투리", dir: "audio/tour/" }, mongsil: { name: "표준어", dir: "audio/tour-mongsil/" } };   // 개나리 = 사투리, 몽실이 = 표준어 (타입캐스트 보이스)
const PICK_KEY = "knu-tour-voice-pick";
const voicePick = () => { try { const v = localStorage.getItem(PICK_KEY); return VOICES[v] ? v : "gaenari"; } catch { return "gaenari"; } };
const setVoicePick = (v) => { try { localStorage.setItem(PICK_KEY, v); } catch {} };
// 안내 멘트 소리 크기 (0~1). 아이폰 Safari는 웹에서 소리 크기를 못 바꿔서 기기 볼륨 버튼으로만 조절돼요
const VOL_KEY = "knu-tour-voice-vol";
const voiceVol = () => { try { const v = parseFloat(localStorage.getItem(VOL_KEY)); return isFinite(v) ? v : 1; } catch { return 1; } };
const setVoiceVol = (v) => { try { localStorage.setItem(VOL_KEY, String(v)); } catch {} if (voiceEl) voiceEl.volume = v; };

// 긴 말을 말풍선 한 줄(약 20자) 크기로 자른다: 문장 → 쉼표 → 띄어쓰기 순서로 끊는다
const LINE_MAX = 30;   // 말풍선 두 줄 정도
function splitLines(text) {
  const out = [];
  const sentences = String(text).match(/[^.!?]+[.!?]*/g) || [String(text)];
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    if (s.length <= LINE_MAX) { out.push(s); continue; }
    let cur = "";
    for (const w of s.split(/\s+/)) {
      if (cur && (cur + " " + w).length > LINE_MAX) { out.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
      if (/,$/.test(cur) && cur.length >= LINE_MAX * 0.6) { out.push(cur); cur = ""; }   // 쉼표에서 끊기 좋으면 끊음
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [String(text)];
}

// 장소에 도착하면 풀 수 있는 퀴즈 (장소마다 한 문제). a: 정답 번호(0부터), why: 정답 설명
const QUIZ = {
  loveroad: { q: "러브로드 전설! 연인이 손을 잡고 어느 쪽으로 걸어야 사랑이 이루어질까?", o: ["본관 → 정문", "정문 → 본관", "북문 → 정문", "뒷걸음으로 아무 데나"], a: 1, why: "정문에서 본관 방향으로 손잡고 걸으면 영원한 사랑이 이루어진대요." },
  ilcheongdam: { q: "일청담은 경북대 상징인 무엇의 모양을 본떠 만들었을까?", o: ["벚꽃", "감꽃", "호반우 뿔", "단풍잎"], a: 1, why: "경북대의 상징인 감꽃 모양을 본떠 만든 연못이에요." },
  library: { q: "중앙도서관 열람실 자리는 어떻게 예약할까?", o: ["도서관 앱으로 예약", "전화로 예약", "학과 사무실에 신청", "예약 없이 선착순만"], a: 0, why: "열람실 자리는 도서관 앱으로 예약해요. 시험 기간엔 금방 차요!" },
  bokji: { q: "개강 전에 교재를 사려면 복지관 어디로 가야 할까?", o: ["우체국", "은행", "서점", "학식당"], a: 2, why: "복지관 서점에서 교재를 살 수 있어요. 학기 초엔 사람이 많아요." },
  centralpark: { q: "센팍 잔디밭에서 열리는, 야외에서 영화를 틀어 주는 행사 이름은?", o: ["무빔", "별빛극장", "센팍시네마", "잔디영화제"], a: 0, why: "센트럴파크에서는 무빔이라는 야외 영화 행사가 열려요." },
  gongstaurant: { q: "공식당의 '공'은 무슨 뜻일까?", o: ["공짜", "공원", "공대", "공부"], a: 2, why: "공대 학생들이 많이 가는 식당이라 공대 식당, 줄여서 공식당이에요." },
  cherryroad: { q: "벚꽃길 바로 근처에 있는 학식당은?", o: ["공식당", "복지관 식당", "도서관 카페", "정문 식당"], a: 0, why: "벚꽃길은 공식당이랑 아주 가까워요. 밥 먹고 산책하기 딱!" },
  stadium: { q: "대운동장 바로 옆 백호관에 모여 있는 곳은?", o: ["기숙사", "중앙동아리방", "열람실", "학생식당"], a: 1, why: "백호관에는 중앙동아리방이 모여 있어요. 동아리 구경 가 봐요!" },
};
const HEART_ZONES = new Set(["loveroad"]);   // 도착 미션 첫 칸이 "하트 그리기"인 장소 (나머지는 "친해지기")
const DONE_KEY = "knu-tour-done";   // { zoneId: { pet: true, quiz: true } } 투어 도착 미션 한 것
const tourDone = (id) => { try { return (JSON.parse(localStorage.getItem(DONE_KEY)) || {})[id] || {}; } catch { return {}; } };
function setTourDone(id, k) {
  try { const all = JSON.parse(localStorage.getItem(DONE_KEY)) || {}; all[id] = { ...(all[id] || {}), [k]: true }; localStorage.setItem(DONE_KEY, JSON.stringify(all)); } catch {}
}
// 퀴즈 창: 맞히면 true. 틀리면 설명을 보여 주고 다시 풀 수 있다
function openQuiz(zone, q, solved) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.id = "tm-sound";   // 아래에서 올라오는 시트 모양 재사용
    el.innerHTML = `<div class="sd tm-quiz">
      <h3>${zone.emoji || "❓"} ${zone.name} 퀴즈${solved ? " <small>(이미 맞혔어요)</small>" : ""}</h3>
      <p class="qz-q">${q.q}</p>
      <div class="qz-o">${q.o.map((t, i) => `<button data-i="${i}">${t}</button>`).join("")}</div>
      <p class="qz-why" hidden></p>
      <button class="sd-close">닫기</button></div>`;
    document.body.appendChild(el);
    let ok = false;
    const close = () => { el.remove(); resolve(ok); };
    el.onclick = (e) => { if (e.target === el) close(); };
    el.querySelector(".sd-close").onclick = close;
    el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => {
      const right = Number(b.dataset.i) === q.a;
      el.querySelectorAll("[data-i]").forEach((x) => x.classList.remove("wrong"));
      b.classList.add(right ? "right" : "wrong");
      const why = el.querySelector(".qz-why");
      why.hidden = false;
      why.textContent = right ? `정답! ${q.why}` : "아쉬워요! 다시 골라 볼까요?";
      if (right) {
        ok = true;
        navigator.vibrate?.(60);
        el.querySelectorAll("[data-i]").forEach((x) => (x.disabled = true));
        el.querySelector(".sd-close").textContent = "좋아요!";
      }
    }));
  });
}

// 지난 대화 전체 보기 (휴대폰에서 말풍선을 누르면)
function openLogSheet(lines) {
  const el = document.createElement("div");
  el.id = "tm-sound";   // 소리 설정 창과 같은 아래 시트 모양
  el.innerHTML = `<div class="sd"><h3>💬 호반우와 나눈 이야기</h3>
    <div class="tm-logsheet">${lines.map((t) => `<p>${t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))}</p>`).join("") || "<p>아직 나눈 이야기가 없어요</p>"}</div>
    <button class="sd-close">닫기</button></div>`;
  document.body.appendChild(el);
  const box = el.querySelector(".tm-logsheet");
  box.scrollTop = box.scrollHeight;
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector(".sd-close").onclick = close;
}

// 소리 설정 칸: 시작하기 전(코스 확인 시트)과 투어 중("음성" 버튼) 둘 다 이 모양 하나를 쓴다
function soundHtml() {
  return `<div class="snd">
    <div class="snd-row">
      <h4 class="ts-h">호반우 안내 음성 <small data-vv></small></h4>
      <div class="seg" data-g="voice">
        <button type="button" data-v="mongsil">표준어</button><button type="button" data-v="gaenari">사투리</button><button type="button" data-v="off">끄기</button>
      </div>
      <input type="range" min="0" max="100" step="5" data-r="voice" aria-label="안내 음성 크기">
      <p class="ts-note">고르거나 크기를 바꾸면 미리 들려줘요</p>
    </div>
    <div class="snd-row">
      <h4 class="ts-h">배경 음악 <small data-bv></small></h4>
      <div class="seg" data-g="bgm"><button type="button" data-v="on">켜기</button><button type="button" data-v="off">끄기</button></div>
      <input type="range" min="0" max="100" step="5" data-r="bgm" aria-label="배경 음악 크기">
    </div>
  </div>`;
}
// box 안의 소리 설정 칸에 동작을 붙인다. onChange: 값이 바뀔 때마다 (위쪽 "음성" 버튼 모양 갱신 등)
function bindSound(box, onChange) {
  const q = (s) => box.querySelector(s);
  const choice = () => (voiceOn() ? voicePick() : "off");
  const paint = () => {
    box.querySelectorAll('[data-g="voice"] button').forEach((b) => b.classList.toggle("on", b.dataset.v === choice()));
    box.querySelectorAll('[data-g="bgm"] button').forEach((b) => b.classList.toggle("on", (b.dataset.v === "on") === bgm.isOn()));
    q('[data-r="voice"]').value = Math.round(voiceVol() * 100);
    q('[data-r="voice"]').disabled = !voiceOn();
    q('[data-r="bgm"]').value = Math.round(bgm.getVolume() * 100);
    q('[data-r="bgm"]').disabled = !bgm.isOn();
    q("[data-vv]").textContent = voiceOn() ? `${Math.round(voiceVol() * 100)}%` : "꺼짐";
    q("[data-bv]").textContent = bgm.isOn() ? `${Math.round(bgm.getVolume() * 100)}%` : "꺼짐";
    onChange?.();
  };
  paint();
  box.querySelectorAll('[data-g="voice"] button').forEach((b) => (b.onclick = () => {
    unlockAudio();
    if (b.dataset.v === "off") { setVoice(false); stopVoice(); }
    else { setVoice(true); setVoicePick(b.dataset.v); playKey("near", SCRIPT.near); }   // 미리 듣기
    paint();
  }));
  box.querySelectorAll('[data-g="bgm"] button').forEach((b) => (b.onclick = () => { bgm.setOn(b.dataset.v === "on"); bgm.resume(); paint(); }));
  q('[data-r="voice"]').oninput = (e) => { setVoiceVol(e.target.value / 100); paint(); };
  q('[data-r="voice"]').onchange = () => { unlockAudio(); playKey("near", SCRIPT.near); };
  q('[data-r="bgm"]').oninput = (e) => { bgm.setVolume(e.target.value / 100); paint(); };
}

// 투어 중 소리 설정 창 (이동 화면 위쪽 "음성" 버튼): 코스 확인 시트와 같은 모양, 코스 정보는 빼고 소리 설정만
function openSoundPanel(host, onChange) {
  const el = document.createElement("div");
  el.id = "tour-sheet";
  el.className = "ts-sound";
  el.innerHTML = `<div class="ts" role="dialog" aria-label="소리 설정">
    <div class="ts-grab" aria-hidden="true"></div>
    <div class="ts-head">
      <h3>소리 설정</h3>
      <button class="ts-x" type="button" aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    ${soundHtml()}
    <p class="ts-credit">호반우 음성: 타입캐스트</p></div>`;
  (host || document.body).appendChild(el);
  bindSound(el, onChange);
  const close = () => el.remove();
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector(".ts-x").onclick = close;
}
let voiceEl = null;   // 하나의 오디오를 돌려 쓴다 (아이폰은 처음 버튼 누를 때 한 번 풀어 줘야 함)
const getVoiceEl = () => (voiceEl = voiceEl || new Audio());
// 키에 맞는 녹음을 재생. 파일이 없거나 재생이 막히면 글자를 TTS로 읽는다
// mode: "interrupt"(지금 말 끊고 바로) / "queue"(지금 말 끝나면) / "skip"(말하는 중이면 건너뜀)
// onStart: 실제로 말을 시작할 때 부름 (말풍선 글자를 음성과 맞추려고)
let playing = false, waiting = [];   // waiting: 지금 말이 끝나면 이어서 할 말 (최대 2개)
function playKey(key, fallbackText, { mode = "interrupt", onStart } = {}) {
  const text = SCRIPT[key] || fallbackText;
  if (!voiceOn()) { onStart?.(); return; }
  if (playing && mode === "skip") return;
  if (playing && mode === "queue") { if (waiting.length < 2) waiting.push({ key, fallbackText, onStart }); return; }
  waiting = [];
  onStart?.();
  const done = () => { playing = false; const w = waiting.shift(); if (w) playKey(w.key, w.fallbackText, { onStart: w.onStart }); else bgm.duck(false); };
  if (!SCRIPT[key]) { speak(text, { interrupt: true }); playing = false; return; }
  try { speechSynthesis.cancel(); } catch {}
  const a = getVoiceEl();
  try { a.pause(); } catch {}
  a.volume = voiceVol();
  playing = true;
  bgm.duck(true);
  a.onended = done;
  let failed = false;
  const fail = () => { if (failed) return; failed = true; speak(text, { interrupt: true }); done(); };
  const pick = voicePick();
  a.onerror = fail;   // 녹음 파일이 없으면 글자 읽기(TTS)로 (대사가 목소리마다 달라서 다른 목소리 파일로 대신하지 않음)
  a.src = VOICES[pick].dir + key + ".mp3";
  a.play().catch((e) => { if (e?.name === "NotAllowedError") fail(); });   // 파일 없음은 onerror가 처리
}
function stopVoice() { waiting = []; playing = false; bgm.duck(false); try { voiceEl?.pause(); } catch {} try { speechSynthesis.cancel(); } catch {} }
const voiceOn = () => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } };
const setVoice = (on) => { try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch {} if (!on) { try { speechSynthesis.cancel(); } catch {} try { voiceEl?.pause(); } catch {} } };
let koVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    koVoice = vs.find((v) => v.lang?.startsWith("ko") && /google|yuna|female|여/i.test(v.name)) || vs.find((v) => v.lang?.startsWith("ko")) || null;
  } catch {}
}
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch {}
const clean = (t) => String(t).replace(/<br\s*\/?>/gi, ". ").replace(/<[^>]+>/g, "")
  .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();
function speak(text, { interrupt = false } = {}) {
  if (!voiceOn() || !("speechSynthesis" in window)) return;
  const t = clean(text);
  if (!t) return;
  try {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "ko-KR"; u.rate = 1.05; u.pitch = 1.1; u.volume = voiceVol();
    if (koVoice) u.voice = koVoice;
    u.onstart = () => bgm.duck(true);
    u.onend = u.onerror = () => { if (!playing) bgm.duck(false); };
    speechSynthesis.speak(u);
  } catch {}
}
/* ---------------- 스타일 ---------------- */
function injectStyle() {
  if (document.getElementById("tour-style")) return;
  const s = document.createElement("style");
  s.id = "tour-style";
  s.textContent = `
  .tb-section{margin-top:14px}
  .tb-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
  .tb-badge{text-align:center;cursor:pointer}
  .tb-medal{position:relative;width:min(84px,24vw);aspect-ratio:1;margin:0 auto 6px;border-radius:50%;overflow:hidden;
    background:radial-gradient(circle at 50% 38%,#f9fafb,#e5e8eb);box-shadow:0 0 0 4px #d1d6db,0 4px 10px rgba(0,0,0,.12)}
  .tb-medal img{width:100%;height:100%;object-fit:contain;padding:10%;box-sizing:border-box;filter:brightness(0) opacity(.18)}
  .tb-medal em{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:var(--fs-3xl, 28px);font-weight:900;color:#b0b8c1}
  .tb-badge.on .tb-medal{box-shadow:0 0 0 4px #e7b84a,0 0 0 7px #fff3cf,0 6px 14px rgba(168,100,0,.3)}
  .tb-badge.on .tb-medal img{filter:none}
  .tb-badge b{display:block;font-size:var(--fs-sm, 13px)}
  .tb-badge span{display:block;font-size:var(--fs-xs, 12px);color:var(--sub,#4e5968);margin-top:2px}
  .tb-badge:not(.on) b{color:var(--mute,#8b95a1)}
  .tb-badge.big{margin:6px auto 12px;cursor:default}
  .tb-badge.big .tb-medal{width:140px;animation:tb-shine 1s ease-out}
  .tb-badge.big b{font-size:var(--fs-lg, 17px)}
  @keyframes tb-shine{0%{transform:scale(.4) rotate(-20deg);opacity:0}60%{transform:scale(1.12) rotate(6deg);opacity:1}100%{transform:none}}
  .tour-card{background:linear-gradient(135deg,var(--primary,#d4121a),#ff6a5b);color:#fff;border-radius:20px;padding:16px 18px;margin:4px 0 14px;
    display:flex;align-items:center;gap:12px;box-shadow:0 10px 24px -12px rgba(212,18,26,.6)}
  .tour-card.tc-new{animation:tcGlow 2.2s ease-in-out infinite}
  @keyframes tcGlow{0%,100%{box-shadow:0 8px 20px -10px rgba(212,18,26,.5)}50%{box-shadow:0 0 0 5px rgba(212,18,26,.18),0 10px 26px -8px rgba(212,18,26,.6)}}
  @media (prefers-reduced-motion:reduce){.tour-card.tc-new{animation:none}}
  .tour-card img{width:58px;height:58px;object-fit:contain;flex:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
  .tour-card .tc-body{flex:1;min-width:0}
  .tour-card b{display:block;font-size:var(--fs-lg, 17px)}
  .tour-card span{display:block;font-size:var(--fs-sm, 13px);opacity:.92;margin-top:2px}
  .tour-card .tc-btns{display:flex;flex-direction:column;gap:6px}
  .tour-card button{width:auto;margin:0;border:none;border-radius:12px;padding:9px 12px;font-size:var(--fs-sm, 13px);font-weight:800;background:#fff;color:var(--primary,#d4121a);
    font-family:inherit;white-space:nowrap}
  .tour-card button.ghost{background:rgba(255,255,255,.2);color:#fff}
  #tour-sheet{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
  #tour-sheet .ts{width:min(560px,100%);max-height:88vh;overflow:auto;background:var(--card,#fff);color:var(--ink,#191f28);border-radius:22px 22px 0 0;
    padding:20px 18px calc(18px + env(safe-area-inset-bottom));font-family:inherit}
  #tour-sheet h3{margin:0 0 4px;font-size:var(--fs-xl, 20px)}
  #tour-sheet .ts-sub{margin:0 0 14px;color:var(--sub,#4e5968);font-size:var(--fs-sm, 13px)}
  /* 코스 고르기 시트: 앱의 다른 화면과 같은 부품(.seg 탭, 장소 목록 같은 줄 카드)으로 맞춘다 */
  #tour-sheet .ts-grab{width:40px;height:4px;margin:-8px auto 14px;border-radius:2px;background:var(--line,#e5e8eb)}
  #tour-sheet .ts-head{display:flex;align-items:flex-start;gap:8px}
  #tour-sheet .ts-head h3{flex:1;margin:0 0 4px}
  #tour-sheet .ts-x{flex:none;width:36px;height:36px;margin:-6px -6px 0 0;display:grid;place-items:center;border-radius:50%;
    background:var(--cream-weak,#f2f4f6);color:var(--sub,#4e5968)}
  #tour-sheet .ts-x svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
  #tour-sheet .ts-sub{word-break:keep-all;line-height:1.5}
  #tour-sheet .seg{margin-bottom:12px}
  #tour-sheet .seg button:disabled{color:var(--mute,#8b95a1);cursor:default}
  #tour-sheet .seg button small{font-size:var(--fs-sm, 13px);font-weight:500}
  .ts-course{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 8px;padding:14px 14px 14px 16px;text-align:left;
    background:var(--card,#fff);border:1px solid var(--line,#e5e8eb);border-radius:16px;box-shadow:var(--shadow-card);
    color:inherit;font-family:inherit;transition:transform .15s var(--ease-toss)}
  .ts-course:active{transform:scale(.985)}
  .ts-course .ic{flex:none;width:44px;height:44px}
  .ts-course .bd{flex:1;min-width:0}
  .ts-course .t{display:flex;align-items:center;gap:6px;font-size:var(--fs-lg, 17px);font-weight:800}
  .ts-course .t em{font-style:normal;font-size:var(--fs-sm, 13px);font-weight:700;color:var(--sub,#4e5968);background:var(--cream-weak,#f2f4f6);padding:2px 8px;border-radius:999px}
  .ts-course .d{display:block;font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968);margin:2px 0 8px;word-break:keep-all}
  .ts-course .r{display:flex;flex-wrap:wrap;align-items:center;gap:4px 0;font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968);line-height:1.4}
  .ts-course .r span{white-space:nowrap}
  .ts-course .r span:not(:last-child)::after{content:"";display:inline-block;width:3px;height:3px;margin:0 6px 2px;border-radius:50%;background:var(--mute,#8b95a1);vertical-align:middle}
  .ts-course .r .st{color:var(--primary,#d4121a);font-weight:700}
  .ts-course .go{flex:none;color:var(--mute,#8b95a1);font-size:var(--fs-xl, 20px)}
  /* 2단계: 고른 코스 자세히 보기 + 설정 + 시작하기 */
  #tour-sheet .ts-back{display:inline-flex;align-items:center;gap:2px;margin:-4px 0 10px -6px;padding:6px 8px;border-radius:10px;
    color:var(--sub,#4e5968);font-size:var(--fs-md, 15px);font-weight:600;font-family:inherit}
  #tour-sheet .ts-back:active{background:var(--cream-weak,#f2f4f6)}
  #tour-sheet .ts-pick{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  #tour-sheet .ts-pick .ic{flex:none;width:52px;height:52px}
  #tour-sheet .ts-pick h3{margin:0}
  #tour-sheet .ts-pick p{margin:2px 0 0;font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968);word-break:keep-all}
  #tour-sheet .ts-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
  #tour-sheet .ts-stats div{padding:10px 8px;border-radius:14px;background:var(--cream-weak,#f2f4f6);text-align:center}
  #tour-sheet .ts-stats b{display:block;font-size:var(--fs-lg, 17px);font-weight:800}
  #tour-sheet .ts-stats small{font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968)}
  #tour-sheet .ts-h{margin:0 0 8px;font-size:var(--fs-md, 15px);font-weight:700;color:var(--sub,#4e5968)}
  /* 경로: 세로 타임라인 (출발 → 1 → 2 …) */
  #tour-sheet .ts-route{list-style:none;margin:0 0 18px;padding:0}
  #tour-sheet .ts-route li{position:relative;display:flex;align-items:center;gap:10px;padding:5px 0;font-size:var(--fs-md, 15px);font-weight:600}
  #tour-sheet .ts-route li:not(:last-child)::before{content:"";position:absolute;left:11px;top:22px;bottom:-12px;border-left:2px dotted var(--line,#e5e8eb)}
  #tour-sheet .ts-route i{position:relative;flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;
    font-size:var(--fs-sm, 13px);font-weight:800;background:var(--primary-weak,#fbe7e5);color:var(--primary-dark,#a30d13)}
  #tour-sheet .ts-route li.start i{background:var(--primary,#d4121a);color:#fff}
  #tour-sheet .ts-route li.start{color:var(--primary,#d4121a)}
  #tour-sheet .ts-set{margin-bottom:14px}
  #tour-sheet .ts-set .seg{margin-bottom:0}
  #tour-sheet .ts-set .seg button{padding:9px 4px}
  #tour-sheet .ts-note{margin:6px 2px 0;font-size:var(--fs-sm, 13px);color:var(--mute,#8b95a1)}
  #tour-sheet .ts-foot{position:sticky;bottom:calc(-18px - env(safe-area-inset-bottom));margin:6px -18px calc(-18px - env(safe-area-inset-bottom));
    padding:12px 18px calc(14px + env(safe-area-inset-bottom));background:var(--card,#fff);border-top:1px solid var(--line,#e5e8eb)}
  #tour-sheet .ts-foot .btn{margin:0}
  @media (prefers-color-scheme:dark){ #tour-sheet .ts-route i{color:#ffb3b7} }
  /* 소리 설정 칸 (코스 확인 시트·투어 중 소리 설정 창 공통) */
  #tour-sheet .snd-row{margin-bottom:16px}
  #tour-sheet .snd .ts-h{display:flex;justify-content:space-between;align-items:center}
  #tour-sheet .snd .ts-h small{font-size:var(--fs-sm, 13px);font-weight:600;color:var(--sub,#4e5968)}
  #tour-sheet .snd .seg{margin-bottom:0}
  #tour-sheet .snd .seg button{padding:9px 4px}
  #tour-sheet .snd input[type=range]{display:block;width:100%;margin:12px 0 0;accent-color:var(--primary,#d4121a)}
  #tour-sheet .snd input[type=range]:disabled{opacity:.35}
  #tour-sheet.ts-sound .ts{max-width:480px}
  #tour-sheet.ts-sound .ts-head{margin-bottom:12px}
  #tour-sheet .ts-credit{margin:4px 0 0;text-align:center;font-size:var(--fs-xs, 12px);color:var(--mute,#8b95a1)}
  /* 일시정지: 이동 화면 위를 덮는 창 */
  #tour-move .tm-icon.pause{display:inline-flex;align-items:center;gap:4px}
  #tour-move .tm-icon.pause svg{width:13px;height:13px;fill:currentColor}
  #tm-pause{position:fixed;inset:0;z-index:2050;display:flex;align-items:center;justify-content:center;padding:24px;
    background:color-mix(in srgb,var(--bg,#fff) 72%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #tm-pause .pz{width:min(360px,100%);padding:24px 20px 20px;border-radius:24px;background:var(--card,#fff);border:1px solid var(--line,#e5e8eb);
    box-shadow:var(--shadow-hero);text-align:center}
  #tm-pause img{width:96px;height:96px;object-fit:contain}
  #tm-pause h3{margin:6px 0 4px;font-size:var(--fs-xl, 20px)}
  #tm-pause p{margin:0 0 18px;font-size:var(--fs-sm, 13px);line-height:1.5;color:var(--sub,#4e5968);word-break:keep-all}
  #tm-pause .btn{margin:0 0 8px}
  .ts-close{width:100%;margin:4px 0 0;padding:12px;border:none;border-radius:12px;background:var(--line,#e5e8eb);color:inherit;font-weight:700;font-family:inherit}
  #tour-move{position:fixed;inset:0;z-index:2000;background:var(--bg,#fff);color:var(--ink,#191f28);display:flex;flex-direction:column;font-family:inherit}
  #tour-move .tm-head{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 14px 8px}
  #tour-move .tm-head b{flex:1;font-size:var(--fs-md, 15px)}
  #tour-move .tm-head small{display:block;font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968);font-weight:600}
  #tour-move .tm-icon.off{opacity:.55;text-decoration:line-through}
  #tour-move .tm-icon{width:auto;margin:0;border:none;background:var(--line,#e5e8eb);color:inherit;border-radius:999px;padding:7px 11px;font-size:var(--fs-sm, 13px);font-weight:700;font-family:inherit}
  #tour-move .tm-steps{display:flex;gap:4px;padding:0 14px 8px}
  #tour-move .tm-steps i{flex:1;height:5px;border-radius:3px;background:var(--line,#e5e8eb)}
  #tour-move .tm-steps i.done{background:var(--primary,#d4121a)}
  #tour-move .tm-steps i.now{background:linear-gradient(90deg,var(--primary,#d4121a) var(--p,0%),var(--line,#e5e8eb) var(--p,0%))}
  #tour-map{flex:1;min-height:180px;margin:0 14px;border-radius:18px;overflow:hidden;background:var(--map-bg,#eef1f4)}
  #tour-map .cm-mark.tm-from span{display:block;padding:2px 8px;border-radius:999px;background:var(--card,#fff);color:var(--ink,#191f28);border:2px solid var(--ink,#191f28);font-size:var(--fs-xs, 12px);font-weight:800;white-space:nowrap}
  /* 소리 설정 창 */
  #tm-sound{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center}
  #tm-sound .sd{width:min(480px,100%);background:var(--card,#fff);color:var(--ink,#191f28);border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom))}
  #tm-sound h3{margin:0 0 14px;font-size:var(--fs-lg, 17px)}
  #tm-sound h4{margin:0 0 8px;font-size:var(--fs-md, 15px);display:flex;justify-content:space-between;align-items:center}
  #tm-sound h4 small{font-weight:600;color:var(--sub,#4e5968);font-size:var(--fs-sm, 13px)}
  #tm-sound .sd-row{margin-bottom:18px}
  #tm-sound .sd-seg{display:flex;gap:6px;margin-bottom:10px}
  #tm-sound .sd-seg button{flex:1;width:auto;margin:0;padding:10px 4px;border-radius:12px;border:2px solid var(--line,#e5e8eb);background:none;color:inherit;font-weight:700;font-size:var(--fs-sm, 13px);font-family:inherit}
  #tm-sound .sd-seg button.on{border-color:var(--primary,#d4121a);color:var(--primary,#d4121a);background:var(--primary-weak,#fbe7e5)}
  #tm-sound input[type=range]{width:100%;accent-color:var(--primary,#d4121a)}
  #tm-sound input[type=range]:disabled{opacity:.35}
  #tm-sound .tm-logsheet{max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
  #tm-sound .tm-logsheet p{margin:0;align-self:flex-start;max-width:92%;background:var(--cream-weak,#f2f4f6);border-radius:14px 14px 14px 4px;padding:9px 12px;font-size:var(--fs-md, 15px);line-height:1.5}
  #tm-sound .tm-logsheet p:last-child{background:var(--primary-weak,#fbe7e5)}
  #tm-sound h3 small{font-size:var(--fs-sm, 13px);color:var(--green,#0a9d63)}
  #tm-sound .qz-q{margin:0 0 12px;font-size:var(--fs-lg, 17px);font-weight:700;line-height:1.5}
  #tm-sound .qz-o{display:grid;gap:8px;margin-bottom:12px}
  #tm-sound .qz-o button{width:100%;margin:0;padding:13px 14px;text-align:left;border-radius:14px;border:1.5px solid var(--line,#e5e8eb);background:var(--card,#fff);color:inherit;font-size:var(--fs-md, 15px);font-weight:700;font-family:inherit}
  #tm-sound .qz-o button.right{border-color:var(--green,#0a9d63);background:var(--green-weak,#e5f7ee);color:var(--green,#0a9d63)}
  #tm-sound .qz-o button.wrong{border-color:var(--primary,#d4121a);background:var(--primary-weak,#fbe7e5);animation:qzShake .3s}
  #tm-sound .qz-o button:disabled{opacity:1}
  #tm-sound .qz-why{margin:0 0 12px;font-size:var(--fs-sm, 13px);line-height:1.5;color:var(--sub,#4e5968)}
  @keyframes qzShake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
  #tm-sound .sd-credit{margin:10px 0 0;text-align:center;font-size:var(--fs-xs, 12px);color:var(--mute,#8b95a1)}
  #tm-sound .sd-close{width:100%;margin:0;padding:13px;border:none;border-radius:14px;background:var(--line,#e5e8eb);color:inherit;font-weight:800;font-family:inherit}
  #tour-move .tm-next{display:flex;align-items:center;gap:12px;padding:12px 16px 4px}
  #tour-move .tm-arrow{width:64px;height:64px;flex:none;border-radius:50%;background:var(--primary-weak,#fbe7e5);display:flex;align-items:center;justify-content:center}
  #tour-move .tm-arrow svg{width:40px;height:40px;transition:transform .25s ease-out}
  #tour-move .tm-dist{flex:1;min-width:0}
  #tour-move .tm-dist b{display:block;font-size:var(--fs-xl, 20px)}
  #tour-move .tm-dist span{font-size:var(--fs-sm, 13px);color:var(--sub,#4e5968)}
  #tour-move .tm-guide{display:flex;align-items:flex-end;gap:8px;padding:6px 14px 0}
  #tour-move .tm-guide img{width:70px;height:70px;object-fit:contain;flex:none}
  #tour-move .tm-bubble{flex:1;background:var(--cream-weak,#f2f4f6);border-radius:18px 18px 18px 4px;padding:11px 14px;font-size:var(--fs-md, 15px);line-height:1.5;margin-bottom:10px}
  #tour-move .tm-btns{display:flex;gap:8px;padding:8px 14px calc(14px + env(safe-area-inset-bottom))}
  #tour-move .tm-btns button{flex:1;width:auto;margin:0;padding:14px;border:none;border-radius:14px;font-size:var(--fs-md, 15px);font-weight:800;font-family:inherit;
    background:var(--line,#e5e8eb);color:inherit}
  #tour-move .tm-btns button.primary{background:var(--primary,#d4121a);color:#fff}
  #tour-move .tm-arrive{animation:tm-pop .5s var(--ease-toss,ease-out)}
  /* (장주연) 휴대폰: 왼쪽에 호반우가 서 있고, 오른쪽 말풍선에 하는 말을 두세 줄씩 */
  #tour-move .tm-walk{display:flex;align-items:flex-end;gap:8px;margin:10px 14px 0;flex:none}
  #tour-move .tm-hob{width:86px;height:86px;object-fit:contain;flex:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.12))}
  #tour-move .tm-say{position:relative;flex:1;min-width:0;min-height:76px;margin:0 0 6px;padding:12px 15px;display:flex;align-items:center;
    background:var(--card,#fff);color:var(--ink,#191f28);border:1.5px solid var(--line,#e5e8eb);border-radius:20px 20px 20px 6px;
    box-shadow:0 6px 16px -8px rgba(25,31,40,.25);cursor:pointer}
  #tour-move .tm-say::before{content:"";position:absolute;left:-9px;bottom:12px;width:14px;height:14px;background:inherit;
    border-left:1.5px solid var(--line,#e5e8eb);border-bottom:1.5px solid var(--line,#e5e8eb);transform:rotate(45deg)}
  #tour-move .tm-line{display:block;font-size:var(--fs-md, 15px);font-weight:700;line-height:1.45;word-break:keep-all;animation:tmLineIn .35s ease-out}
  @keyframes tmLineIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  /* 대화 기록: 호반우가 한 말이 위로 쌓인다 (마지막 말이 말풍선) */
  #tour-move .tm-log{position:relative;flex:none;max-height:112px;overflow-y:auto;padding:8px 14px 0;display:none;flex-direction:column;gap:6px;scroll-behavior:smooth}
  #tour-move .tm-log p{margin:0;align-self:flex-start;max-width:92%;background:var(--cream-weak,#f2f4f6);border-radius:14px 14px 14px 4px;padding:7px 11px;font-size:var(--fs-sm, 13px);line-height:1.45;color:var(--sub,#4e5968)}
  #tour-move .tm-log p.now{font-size:var(--fs-md, 15px);color:var(--ink,#191f28);padding:10px 13px;background:var(--primary-weak,#fbe7e5)}
  /* 아래 버튼: [사진][쓰다듬기] 작게 + 지금 할 일(도착했어요 / 다음 장소로) 크게 */
  #tour-move .tm-btns{display:grid;grid-template-columns:1fr 2fr;gap:8px;align-items:stretch}
  #tour-move .tm-btns.arrived{grid-template-columns:1fr}
  #tour-move .tm-missions{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px}
  #tour-move .tm-ms{width:auto;margin:0;padding:10px 6px;border-radius:14px;border:1.5px solid color-mix(in srgb,var(--primary,#d4121a) 35%,transparent);
    background:var(--primary-weak,#fbe7e5);color:var(--ink,#191f28);font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px}
  #tour-move .tm-ms b{font-size:var(--fs-md, 15px);color:var(--primary,#d4121a)}
  #tour-move .tm-ms span{font-size:var(--fs-xs, 12px);color:var(--sub,#4e5968);font-weight:600}
  #tour-move .tm-ms.done{background:var(--card,#fff);border-color:var(--line,#e5e8eb)}
  #tour-move .tm-ms.done b{color:var(--green,#0a9d63)}
  #tour-move .tm-btns button.sub{padding:12px 4px;font-size:var(--fs-md, 15px);background:var(--card,#fff);border:1.5px solid var(--line,#e5e8eb);color:var(--ink,#191f28)}
  #tour-move .tm-btns button.primary{font-size:var(--fs-md, 15px)}
  /* 데모로 걷기: 실제 사용 흐름과 헷갈리지 않게 지도 위 작은 버튼 (관리자 "데모 모드"일 때만) */
  #tour-move .tm-demo{position:absolute;left:10px;top:10px;z-index:5;width:auto;margin:0;padding:7px 12px;border:none;border-radius:999px;
    background:rgba(25,31,40,.78);color:#fff;font-size:var(--fs-sm, 13px);font-weight:800;font-family:inherit}
  #tour-move .tm-demo:disabled{opacity:.5}
  #tour-map{position:relative}
  @media (prefers-reduced-motion:reduce){ #tour-move .tm-walk *{animation:none!important} }
  .tour-pin{width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid var(--primary,#d4121a);display:flex;align-items:center;justify-content:center;
    font-size:var(--fs-lg, 17px);box-shadow:0 3px 8px rgba(0,0,0,.25)}
  .tour-tip{background:var(--primary, #d4121a);color:#fff;border:none;border-radius:999px;padding:3px 9px;font-weight:800;font-size:var(--fs-sm, 13px);box-shadow:0 2px 6px rgba(0,0,0,.25)}
  .tour-tip::before{display:none}
  .tour-tip.me{background:#2f6fed}
  .tour-from{background:#fff;color:#191f28;border:2px solid #191f28;border-radius:999px;font-size:var(--fs-xs, 12px);font-weight:800;text-align:center;line-height:18px}
  .tm-legend{display:flex;gap:12px;flex-wrap:wrap;padding:6px 18px 0;font-size:var(--fs-xs, 12px);color:var(--sub,#4e5968)}
  .tm-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
  .tour-me{width:18px;height:18px;border-radius:50%;background:#2f6fed;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,237,.25)}
  @keyframes tm-pop{0%{transform:scale(.9);opacity:.3}100%{transform:none;opacity:1}}
  /* PC(넓은 화면)·휴대폰 가로: 왼쪽 큰 지도 + 오른쪽 안내 */
  @media (orientation:landscape) and (max-height:520px){ #tour-move .tm-guide img{width:56px!important;height:56px!important}
    #tour-move .tm-side{overflow-y:auto} #tour-move .tm-walk{height:70px!important} #tour-move .tm-log{max-height:84px}
    #tour-move .tm-bubble{font-size:var(--fs-sm, 13px)!important;padding:8px 12px} #tour-move .tm-btns button{padding:11px} #tour-move .tm-arrow{width:52px;height:52px} }
  @media (min-width:900px), (orientation:landscape) and (max-height:520px){
    #tour-move{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,1fr);grid-template-rows:auto auto minmax(0,1fr) auto}
    #tour-move .tm-head,#tour-move .tm-steps{grid-column:1 / -1}
    #tour-map{grid-column:1;grid-row:3;margin:0 0 0 16px;min-height:0}
    #tour-move .tm-legend{grid-column:1;grid-row:4;padding:6px 16px 12px}
    #tour-move .tm-side{grid-column:2;grid-row:3 / 5;display:flex;flex-direction:column;justify-content:center;padding:0 8px 16px}
    #tour-move .tm-bubble{font-size:var(--fs-lg, 17px)} #tour-move .tm-guide img{width:96px;height:96px}
    /* 넓은 화면도 휴대폰과 같게: 호반우 그림 + 지금 하는 말 한 줄 (지난 대화는 말풍선을 누르면) */
    #tour-move .tm-walk{margin:14px 0 10px} #tour-move .tm-hob{width:104px;height:104px} #tour-move .tm-line{font-size:var(--fs-lg, 17px)} }`;
  document.head.appendChild(s);
}

/* ---------------- 홈 탭 투어 카드 ---------------- */
const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 70));   // 실제 길은 직선보다 1.3배쯤 길다고 보고, 분당 70m
function courseStats(c, gate = GATES.main) {
  let prev = gate, dist = 0;
  c.stops.forEach((id) => { const z = zoneById(id); if (z) { dist += geo.distanceM(prev, z); prev = z; } });
  return { walk: walkMin(dist), total: walkMin(dist) + c.stops.length * 4 };
}
// entry=false(홈): 투어를 시작한 사람에게만 "이어서 하기" 카드 / entry=true(캠퍼스 탐험): 늘 보이는 투어 입구 (장주연)
const TRIED_KEY = "knu-tour-tried";   // 한 번이라도 코스를 골랐는지 (안 해 본 사람에게는 입구 카드를 반짝이게)
export function renderQuestCard(container, { entry = false } = {}) {
  if (!TOUR_ON || !container || !app) return;
  injectStyle();
  container.querySelector(".tour-card")?.remove();
  const st = load();
  const c = st && course(st.course);
  if (!c && !entry) return;   // 홈: 진행 중인 투어가 없으면 카드 없음
  const card = document.createElement("div");
  card.className = "tour-card";
  let tried = false;
  try { tried = localStorage.getItem(TRIED_KEY) === "1"; } catch {}
  if (entry && !c && !tried) card.classList.add("tc-new");
  const curZone = c && zoneById(c.stops[st.idx]);
  const here = c && st.arrived === st.idx;        // 지금 장소에 이미 도착해 있음 (미션 중)
  const nextZone = c && zoneById(c.stops[st.idx + 1]);
  card.innerHTML = c
    ? `<img src="img/hobanu/react-hi.png" alt=""><div class="tc-body"><b>${c.emoji} ${c.name}</b>
         <span>진행 중 ${Math.min(st.idx + 1, c.stops.length)} / ${c.stops.length} · ${here ? `지금: ${curZone?.name || ""}` : `다음: ${curZone?.name || ""}`}</span></div>
       <div class="tc-btns">${here
         ? `<button data-a="next">${nextZone ? "다음 장소로 →" : "🏁 완주하기"}</button>`
         : `<button data-a="go">이어서 하기</button>`}<button class="ghost" data-a="stop">그만하기</button></div>`
    : `<img src="img/hobanu/react-hi.png" alt=""><div class="tc-body"><b>호반우와 캠퍼스 투어</b>
         <span>정문에서 출발해 호반우가 길 안내·장소 소개를 해 줘요!</span></div>
       <div class="tc-btns"><button data-a="pick">코스 고르기</button></div>`;
  container.prepend(card);
  card.querySelector('[data-a="pick"]')?.addEventListener("click", () => (app?.goTab ? app.goTab("course") : openCourseSheet()));   // 주소 #course로 (뒤로 가기·링크 공유)
  card.querySelector('[data-a="go"]')?.addEventListener("click", () => { unlockAudio(); openMove(); });
  card.querySelector('[data-a="next"]')?.addEventListener("click", () => { unlockAudio(); next(curZone); });
  card.querySelector('[data-a="zone"]')?.addEventListener("click", () => curZone && app.openZone(curZone));
  card.querySelector('[data-a="stop"]')?.addEventListener("click", async () => {
    if (!(await confirmDialog({ title: "투어를 그만할까요?", message: "지금까지 한 미션과 XP는 그대로 남아요.", ok: "그만하기", cancel: "계속하기" }))) return;
    save(null); renderQuestCard(container);
  });
}
// 코스 고르기 시트. main.js가 주소 #course일 때 연다. onClose: 사용자가 닫거나 투어를 시작해서 시트가 사라질 때
// (뒤로 가기 등으로 다른 화면이 되면 main.js가 closeCourseSheet()로 조용히 닫는다 — 이때는 onClose를 부르지 않음)
let sheetQuietClose = null;
export function closeCourseSheet() { sheetQuietClose?.(); }
export function openCourseSheet({ onClose } = {}) {
  closeCourseSheet();
  injectStyle();
  const el = document.createElement("div");
  el.id = "tour-sheet";
  document.body.appendChild(el);
  const quiet = () => { stopVoice(); bgm.stop(); };   // 미리 듣기로 나던 소리 끄기 (설정 값은 그대로)
  sheetQuietClose = () => { sheetQuietClose = null; quiet(); el.remove(); };
  const close = () => { sheetQuietClose?.(); onClose?.(); };
  el.onclick = (e) => { if (e.target === el) close(); };
  const head = (title, label) => `
    <div class="ts-grab" aria-hidden="true"></div>
    <div class="ts-head">
      <h3>${title}</h3>
      <button class="ts-x" type="button" aria-label="${label}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>`;
  const stopNames = (c) => c.stops.map((id) => zoneById(id)?.name || id);

  // ① 코스 고르기: 누르면 바로 시작하지 않고 ②로
  function showList() {
    el.innerHTML = `<div class="ts" role="dialog" aria-label="투어 코스 고르기">
      ${head("호반우와 캠퍼스 투어", "닫기")}
      <p class="ts-sub">호반우가 길을 안내하고 장소를 소개해 줘요. 걸으면서 사진도 찍고 호반우도 쓰다듬어 봐요!</p>
      ${COURSES.map((c) => `
        <button class="ts-course" type="button" data-c="${c.id}">
          <span class="ic" aria-hidden="true">${icon(c.icon)}</span>
          <span class="bd">
            <span class="t">${c.name}<em>${c.stops.length}곳 · 약 ${courseStats(c).total}분</em></span>
            <span class="d">${c.desc}</span>
            <span class="r"><span class="st">정문</span>${stopNames(c).map((n) => `<span>${n}</span>`).join("")}</span>
          </span>
          <span class="go" aria-hidden="true">›</span>
        </button>`).join("")}
    </div>`;
    el.querySelector(".ts-x").onclick = close;
    el.querySelectorAll(".ts-course").forEach((b) => (b.onclick = () => showDetail(course(b.dataset.c))));
  }

  // ② 코스 자세히 + 설정 + 시작하기. 소리 설정은 이동 화면의 "음성" 버튼과 같은 값을 쓴다
  function showDetail(c) {
    const gate = GATES.main;   // 북문이 생기면 여기서 고른 문으로
    const s = courseStats(c, gate);
    el.innerHTML = `<div class="ts" role="dialog" aria-label="${c.name} 시작하기">
      ${head("코스 확인", "닫기")}
      <button class="ts-back" type="button">‹ 다른 코스 보기</button>
      <div class="ts-pick">
        <span class="ic" aria-hidden="true">${icon(c.icon)}</span>
        <div><h3>${c.name}</h3><p>${c.desc}</p></div>
      </div>
      <div class="ts-stats">
        <div><b>${c.stops.length}곳</b><small>장소</small></div>
        <div><b>약 ${s.walk}분</b><small>걷는 시간</small></div>
        <div><b>약 ${s.total}분</b><small>미션 포함</small></div>
      </div>
      <h4 class="ts-h">이 순서로 돌아요</h4>
      <ol class="ts-route">
        <li class="start"><i>출</i>${gate.name}에서 출발</li>
        ${stopNames(c).map((n, i) => `<li><i>${i + 1}</i>${n}</li>`).join("")}
      </ol>
      <div class="ts-set">
        <h4 class="ts-h">출발 장소</h4>
        <div class="seg" data-g="gate">
          <button type="button" class="on">정문</button>
          <button type="button" disabled>북문 <small>준비 중</small></button>
        </div>
      </div>
      ${soundHtml()}
      <p class="ts-note" style="margin:-4px 2px 4px">소리 설정은 투어 중에도 위쪽 "음성" 버튼에서 바꿀 수 있어요</p>
      <div class="ts-foot"><button class="btn cta-glow ts-start" type="button">시작하기</button></div>
    </div>`;
    bindSound(el.querySelector(".snd"));   // 음악을 켜면 미리 들려줌 (시트를 닫거나 시작하면 quiet()로 끔)
    el.querySelector(".ts-x").onclick = close;
    el.querySelector(".ts-back").onclick = () => { quiet(); showList(); };
    el.querySelector(".ts-start").onclick = () => {
      quiet();   // 이동 화면이 열리면서 음악·안내를 처음부터 다시 튼다
      unlockAudio();
      save({ course: c.id, idx: 0, gate: "main", startedAt: Date.now() });
      try { localStorage.setItem(TRIED_KEY, "1"); } catch {}
      sheetQuietClose = null;
      el.remove();
      onClose?.();   // 주소의 #course를 정리 (이동 화면은 그 위에 따로 뜬다)
      openMove(true);
    };
    el.querySelector(".ts").scrollTop = 0;
  }

  showList();
}
// 아이폰은 버튼을 누른 순간에 한 번 소리를 내 줘야 그 뒤에도 음성이 나온다
function unlockAudio() {
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {}
  try {   // 녹음 재생용 오디오도 버튼 누른 순간에 한 번 재생해서 풀어 둔다 (무음)
    const a = getVoiceEl();
    a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    a.play().then(() => a.pause()).catch(() => {});
  } catch {}
  try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch {}
}

/* ---------------- 구역 채팅과 연결 (main.js가 부름) ---------------- */
// 미션 메뉴/구역 클리어 선택지에 넣을 "다음 장소로" 버튼. 투어 중이고 지금 장소가 투어 순서의 장소일 때만
export function menuItem(zone) {
  if (!isActive() || curStopId() !== zone.id) return null;
  const st = load(), c = course(st.course);
  const nextId = c.stops[st.idx + 1];
  return { label: nextId ? `🐮 다음 장소로 (투어) · ${zoneById(nextId)?.name || ""}` : "🏁 투어 완주하기", value: "__tour", ghost: false };
}
// 지금 장소를 끝내고 다음 장소로 이동 화면을 연다
export function next(zone) {
  const st = load();
  if (!st) return;
  const c = course(st.course);
  if (zone && c.stops[st.idx] === zone.id) st.idx++;
  if (st.idx >= c.stops.length) { save(null); try { app.goTab("home"); } catch {} return finish(st); }
  save(st);
  try { app.goTab("home"); } catch {}
  openMove();
}

/* ---------------- 이동 화면 ---------------- */
let mv = null;   // 지금 열린 이동 화면의 상태
const LOG_KEY = "knu-tour-log";   // 호반우 대화 기록 (이 탭을 닫으면 지워짐)
let tourLog = (() => { try { return JSON.parse(sessionStorage.getItem(LOG_KEY)) || []; } catch { return []; } })();
// 걷는 호반우 배경 (hero.js 그림을 단순하게 다시 그림: 먼 언덕·건물 / 가까운 나무·건물)
const FAR_SVG = `<svg viewBox="0 0 600 230" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
  <path d="M0 200 Q80 150 170 190 T360 185 T600 195 V230 H0Z" fill="var(--hx-hill2)"/>
  <rect x="40" y="120" width="70" height="80" rx="22" fill="var(--hx-far1)"/><circle cx="75" cy="118" r="26" fill="var(--hx-far2)"/>
  <rect x="250" y="110" width="90" height="90" rx="26" fill="var(--hx-far3)"/>
  <rect x="440" y="130" width="60" height="70" rx="20" fill="var(--hx-far4)"/><circle cx="470" cy="128" r="20" fill="var(--hx-far4)"/></svg>`;
const NEAR_SVG = `<svg viewBox="0 0 600 230" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
  <path d="M0 206 Q150 186 300 204 T600 204 V230 H0Z" fill="var(--hx-hill)"/>
  <rect x="10" y="118" width="110" height="90" rx="26" fill="var(--hx-wall)"/><path d="M10 140 Q65 84 120 140Z" fill="var(--hx-roof)"/>
  <circle cx="168" cy="168" r="24" fill="var(--hx-tree1)"/><circle cx="186" cy="152" r="18" fill="var(--hx-tree2)"/><rect x="163" y="186" width="10" height="22" rx="5" fill="var(--hx-trunk)"/>
  <ellipse cx="300" cy="200" rx="46" ry="10" fill="var(--hx-pool)"/><path d="M300 196 Q290 170 300 150 Q310 170 300 196" fill="var(--hx-jet)"/>
  <rect x="390" y="124" width="100" height="84" rx="26" fill="var(--hx-wall)"/><rect x="390" y="124" width="100" height="26" rx="13" fill="var(--hx-roof2)"/>
  <circle cx="540" cy="174" r="20" fill="var(--hx-tree3)"/><circle cx="556" cy="160" r="15" fill="var(--hx-tree4)"/><rect x="536" y="188" width="9" height="20" rx="4.5" fill="var(--hx-trunk)"/></svg>`;
function closeMove() {
  if (!mv) return;
  try { mv.stop(); } catch {}
  mv.root.remove();
  mv = null;
}
function openMove(first = false) {
  try { _openMove(first); } catch (e) {
    console.warn("[투어] 이동 화면 오류", e);
    closeMove();
    app?.ui?.toast?.("투어 화면을 여는 중 문제가 생겼어요. 구역 목록에서 계속할 수 있어요.");
  }
}
function _openMove(first) {
  closeMove();
  injectStyle();
  const st = load(), c = course(st?.course);
  if (!c) return;
  const zone = zoneById(c.stops[st.idx]);
  if (!zone) return;
  const prev = st.idx === 0 ? GATES[st.gate || "main"] : zoneById(c.stops[st.idx - 1]);
  const wayKey = `way-${st.idx === 0 ? "gate" : prev.id}-${zone.id}`;   // 예: way-loveroad-ilcheongdam
  const mascot = MASCOTS[zone.id]?.img || "img/hobanu/react-hi.png";
  const themeId = (() => { try { return currentTheme()?.id || ""; } catch { return ""; } })();
  if (first) { tourLog = []; try { sessionStorage.removeItem(LOG_KEY); } catch {} }

  const root = document.createElement("div");
  root.id = "tour-move";
  root.innerHTML = `
    <div class="tm-head">
      <b>${c.emoji} ${c.name}<small>${st.idx + 1}번째 장소 / 총 ${c.stops.length}곳</small></b>
      <button class="tm-icon pause" data-a="pause" aria-label="일시정지"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>일시정지</button>
      <button class="tm-icon" data-a="voice"></button>
      <button class="tm-icon" data-a="out">나가기</button>
    </div>
    <div class="tm-steps">${c.stops.map((_, i) => `<i class="${i < st.idx ? "done" : i === st.idx ? "now" : ""}"></i>`).join("")}</div>
    <div id="tour-map"></div>
    <div class="tm-legend"><span><i style="background:#3182f6"></i>내 위치</span></div>
    <div class="tm-side">
      <div class="tm-next">
        <div class="tm-arrow"><svg viewBox="0 0 40 40"><path d="M20 3 L33 34 L20 27 L7 34 Z" fill="var(--primary,#d4121a)"/></svg></div>
        <div class="tm-dist"><b>${zone.name}</b><span>거리를 재는 중…</span></div>
      </div>
      <div class="tm-walk">
        <img class="tm-hob" src="img/hobanu/react-hi.png" alt="호반우">
        <p class="tm-say" role="button" aria-label="호반우가 한 말 (누르면 지난 대화 보기)"></p>
      </div>
      <div class="tm-log" aria-live="polite"></div>
      <div class="tm-btns"></div>
    </div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  // (장주연) 호반우가 한 말은 대화 기록으로 쌓는다 (투어 내내 유지, 장소가 바뀌어도 이어서 보임)
  const logBox = $(".tm-log");
  const escT = (t) => t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
  const sayBox = $(".tm-say");
  // PC: 대화 기록 전체 (높이 고정 + 스크롤바). 지금 하는 말이 가운데, 지난 말은 위로
  const paintLog = () => {
    logBox.innerHTML = tourLog.map((t, i) => `<p class="${i === tourLog.length - 1 ? "now" : ""}">${escT(t)}</p>`).join("") || `<p class="now">같이 가 보자!</p>`;
    const cur = logBox.querySelector("p.now");
    if (cur) logBox.scrollTop = Math.max(0, cur.offsetTop - logBox.clientHeight / 2 + cur.offsetHeight / 2);
  };
  // 휴대폰: 긴 말을 한 줄 크기로 잘라 말풍선에 한 줄씩 (음성이 나오는 속도에 맞춰 넘어간다)
  let live = null, liveIdx = -1;
  const showLine = (t, audio) => {
    live = { parts: splitLines(t), start: Date.now(), audio };
    liveIdx = -1;
    tickLine();
  };
  const tickLine = () => {
    if (!live) return;
    const total = live.parts.reduce((s, p) => s + p.length, 0) || 1;
    let frac;
    const a = voiceEl;
    if (live.audio && a && !a.paused && isFinite(a.duration) && a.duration > 0) frac = a.currentTime / a.duration;
    else frac = (Date.now() - live.start) / (total * 110);   // 녹음이 없으면 한 글자 0.11초로 어림
    let acc = 0, idx = live.parts.length - 1;
    for (let i = 0; i < live.parts.length; i++) { acc += live.parts[i].length; if (frac * total < acc) { idx = i; break; } }
    if (idx === liveIdx) return;
    liveIdx = idx;
    sayBox.innerHTML = `<span class="tm-line">${escT(live.parts[idx])}</span>`;
  };
  const lineTimer = setInterval(tickLine, 150);
  sayBox.onclick = () => openLogSheet(tourLog);
  const addLog = (t, audio = false) => {
    t = clean(t);
    if (!t || tourLog[tourLog.length - 1] === t) return;
    tourLog.push(t);
    if (tourLog.length > 40) tourLog.shift();
    try { sessionStorage.setItem(LOG_KEY, JSON.stringify(tourLog)); } catch {}
    if (mv?.root === root || !mv) { paintLog(); showLine(t, audio); }
  };
  paintLog();
  if (tourLog.length) showLine(tourLog[tourLog.length - 1], false); else sayBox.innerHTML = `<span class="tm-line">같이 가 보자!</span>`;
  const bubble = (t, opt) => { addLog(t); speak(t, opt); };
  // 글자로만 띄울 말: 호반우가 말하는 중이면 끝난 뒤에 (말풍선이 음성과 엇갈리지 않게)
  const addAfterVoice = (t) => {
    const tryIt = () => { if (mv?.root !== root) return; if (playing || waiting.length) setTimeout(tryIt, 500); else addLog(t); };
    setTimeout(tryIt, 600);
  };
  const say = (key, fallback, mode = "interrupt") => playKey(key, fallback, { mode, onStart: () => addLog(SCRIPT[key] || fallback, voiceOn() && !!SCRIPT[key]) });

  // --- 걷는 호반우: 실제로 움직이는 동안만 걷는다 ---
  const walk = $(".tm-walk");
  let lastMoveAt = 0, lastP = null;
  const setMoving = (on) => {
    walk.classList.toggle("moving", on);
    const sEl = walk.querySelector(".tm-state");   // (걷는 그림을 없애서 지금은 없음)
    if (sEl) sEl.textContent = arrived ? "도착!" : on ? "열심히 걷는 중" : "잠깐 쉬는 중";
  };
  const moveTimer = setInterval(() => { if (!arrived) setMoving(demoRunning || Date.now() - lastMoveAt < 6000); }, 1000);

  // --- 도구: 사진 · 쓰다듬기 (배경 음악은 위쪽 "음성" 설정 창에서) ---
  bgm.start();
  root.addEventListener("pointerdown", () => bgm.resume(), { passive: true });   // 휴대폰이 소리를 막아 두면 화면을 누를 때 다시 켠다
  // 사진·쓰다듬기 화면에 가 있는 동안에도 위치는 계속 기록한다 (말은 잠깐 멈춤).
  // 돌아왔을 때 많이 움직였으면 지금 위치에서 길을 다시 찾고, 그사이 도착했으면 도착 처리
  let away = false, awayFrom = null, pendingArrive = false;
  const goAway = () => { away = true; awayFrom = lastPos; stopVoice(); bgm.duck(true); };
  const comeBack = () => {
    away = false;
    bgm.duck(false);
    if (pendingArrive) { pendingArrive = false; arrive(); return; }
    if (lastPos && awayFrom && geo.distanceM(lastPos, awayFrom) > 30) {
      addLog("그사이 꽤 걸었네! 지금 위치에서 길을 다시 찾아볼게.");
      if (geo.distanceM(lastPos, zone) < 3000) loadRoute(lastPos);
    }
  };
  const doPhoto = async () => {
    goAway();
    let took = false;
    const atPlace = arrived;   // 도착한 뒤에 찍은 사진만 도착 미션(+10 XP)
    try { await openPhotoStudio({ start: "basic", place: arrived ? zone.name : `${zone.name} 가는 길`, zoneId: arrived ? zone.id : null, record: true, onShot: () => (took = true) }); }
    catch (e) { console.warn("[투어] 사진", e); }
    comeBack();
    if (atPlace && took && !tourDone(zone.id).photo) {
      setTourDone(zone.id, "photo");
      if (app.store.grantBonus("tourphoto:" + zone.id, 10)) app.ui.reward(10);
      addLog("사진 예쁘게 나왔다! 추억 하나 추가!");
      paintBtns();
    }
  };
  // 도착 미션 ① 쓰다듬기: 이 장소의 호반우가 AR로 나온다 (처음 만나면 도감 등록, 친밀도도 오른다)
  const doPet = async () => {
    goAway();
    try {
      // 러브로드는 전설에 맞춰 "하트 그리기"(zones.json의 러브로드 AR 미션), 다른 장소는 쓰다듬기 (장주연)
      const heart = HEART_ZONES.has(zone.id) && (zone.missions?.find((m) => m.ar === "heart") || { id: "m-loveroad-ar", ar: "heart", title: "호반우에게 하트 그리기" });
      const r = await startAR(zone, { mission: heart ? { ...heart, title: "호반우에게 하트 그리기" } : { id: "tour-pet-" + zone.id, ar: "pet", title: `${zone.name} 호반우 쓰다듬기` } });
      if (r?.done) {
        if (!tourDone(zone.id).pet) { setTourDone(zone.id, "pet"); if (app.store.grantBonus("tourpet:" + zone.id, 10)) app.ui.reward(10); }
        addLog(heart ? "하트 잘 받았어! 러브로드 전설, 이제 너도 알지?" : `${zone.name} 호반우랑 친해졌어!`);
      }
    } catch (e) { console.warn("[투어] 쓰다듬기", e); }
    comeBack();
    paintBtns();
  };
  // 도착 미션 ② 장소 퀴즈 한 문제
  const doQuiz = async () => {
    const q = QUIZ[zone.id];
    if (!q) return;
    const ok = await openQuiz(zone, q, !!tourDone(zone.id).quiz);
    if (ok && !tourDone(zone.id).quiz) {
      setTourDone(zone.id, "quiz");
      if (app.store.grantBonus("tourquiz:" + zone.id, 15)) app.ui.reward(15);
      addLog("정답! 이제 이 장소 박사네!");
    }
    paintBtns();
  };
  const vBtn = $('[data-a="voice"]');
  // "음성" 버튼 → 소리 설정 창: 안내 멘트(사투리·표준어·끄기 + 크기), 배경 음악(켜기·끄기 + 크기)
  const paintVoice = () => { vBtn.textContent = "음성"; vBtn.classList.toggle("off", !voiceOn() && !bgm.isOn()); };
  paintVoice();
  vBtn.onclick = () => openSoundPanel(root, paintVoice);
  $('[data-a="out"]').onclick = () => { stopVoice(); closeMove(); try { app.goTab("home"); } catch {} };

  // --- 일시정지: 안내 말·배경 음악·위치 따라가기·데모 걷기를 멈추고, "이어서 하기"를 누르면 다시 ---
  // 멈춘 동안 들어온 위치는 쓰지 않는다 (그사이 도착해도, 이어서 하면 다음 위치에서 도착 처리)
  let paused = false;
  function pauseTour() {
    if (paused || arrived) return;
    paused = true;
    stopVoice();
    bgm.stop();
    if (demoRunning) {   // 데모 걷기는 멈추고 버튼을 다시 누를 수 있게
      demoRunning = false;
      cancelAnimationFrame(demoRaf);
      const b = $(".tm-demo");
      if (b) { b.disabled = false; b.textContent = "▶ 데모로 걷기"; }
    }
    setMoving(false);
    const pz = document.createElement("div");
    pz.id = "tm-pause";
    pz.innerHTML = `<div class="pz" role="dialog" aria-label="일시정지">
      <img src="img/hobanu/react-hi.png" alt="">
      <h3>잠깐 쉬어 갈까?</h3>
      <p>안내와 음악을 멈췄어요. 준비되면 <b>${zone.name}</b>까지 이어서 가요.</p>
      <button class="btn" type="button" data-p="resume">이어서 하기</button>
      <button class="btn alt" type="button" data-p="out">투어 나가기</button></div>`;
    root.appendChild(pz);
    pz.querySelector('[data-p="resume"]').onclick = resumeTour;
    pz.querySelector('[data-p="out"]').onclick = () => $('[data-a="out"]').click();
  }
  function resumeTour() {
    if (!paused) return;
    paused = false;
    root.querySelector("#tm-pause")?.remove();
    unlockAudio();
    bgm.start();
    bgm.resume();
    addLog(`다시 가 보자! ${zone.name}까지 같이 가자.`);
  }
  $('[data-a="pause"]').onclick = pauseTour;

  // --- 지도: 미션 화면과 같은 캠퍼스 일러스트 지도 (campusmap.js) (장주연) ---
  let map = null, lastPos = null;
  if (campusDataReady()) {
    map = new CampusMap($("#tour-map"), {
      labelAt: { big: 0.5, all: 1.0, zone: 0.4 },
      onMapClick: DEBUG ? (q) => {
        const t = `${q.lat.toFixed(6)}, ${q.lng.toFixed(6)}`;
        navigator.clipboard?.writeText(t).catch(() => {});
        app?.ui?.toast?.(`좌표 복사: ${t}`);
      } : null,
    });
    map.setArea(zone);   // 빨간 점선 영역 = 이 안에 들어오면 도착
    map.setZones([zone], { status: () => "next" });
    map.setMarks([{ lat: prev.lat, lng: prev.lng, cls: "tm-from", html: "<span>출발</span>" }]);
  } else {
    $("#tour-map").innerHTML = `<div style="padding:20px;text-align:center;color:var(--sub,#4e5968)">지도를 불러오지 못했어요. 화살표와 거리를 보고 이동해 주세요.</div>`;
  }
  function drawRoute(pts) {
    if (!map) return;
    map.setRoute(pts);
    map.fit(pts, 40);
  }
  function setMe(p) {
    lastPos = p;
    map?.setMe(p);
  }
  let route = [prev, zone].map((p) => ({ lat: p.lat, lng: p.lng }));
  drawRoute(route);
  async function loadRoute(from) {
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${zone.lng},${zone.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const coords = (await res.json()).routes?.[0]?.geometry?.coordinates;
      if (coords?.length > 1 && mv?.root === root) { route = [from, ...coords.map(([lng, lat]) => ({ lat, lng })), { lat: zone.lat, lng: zone.lng }]; drawRoute(route); }
    } catch {}
  }
  const routeReady = loadRoute(prev);

  // --- 방향(나침반) ---
  let heading = null;
  const onOri = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;
    if (h != null) heading = h;
  };
  window.addEventListener("deviceorientationabsolute", onOri);
  window.addEventListener("deviceorientation", onOri);
  let lastBearing = 0;
  const arrowTimer = setInterval(() => {
    const rotDeg = heading == null ? lastBearing : lastBearing - heading;
    const svg = $(".tm-arrow svg");
    if (svg) svg.style.transform = `rotate(${rotDeg}deg)`;
  }, 200);

  // --- 화면 꺼짐 방지 ---
  let wake = null;
  try { navigator.wakeLock?.request("screen").then((w) => (wake = w)).catch(() => {}); } catch {}

  // --- 위치가 바뀔 때마다 ---
  let d0 = null, minD = Infinity, said = {}, arrived = false, lastWrong = 0, lastUi = 0;
  const poiSaid = new Set();
  function onPos(p, { sim = false } = {}) {
    if (arrived || !mv || paused) return;
    setMe(p);
    const d = geo.distanceM(p, zone);
    lastBearing = geo.bearingDeg(p, zone);
    if (sim || !lastP || geo.distanceM(lastP, p) > 2) { lastMoveAt = Date.now(); lastP = p; if (!walk.classList.contains("moving")) setMoving(true); }
    if (d0 == null) d0 = Math.max(d, 1);
    minD = Math.min(minD, d);
    const pct = Math.max(0, Math.min(100, 100 - (d / d0) * 100));
    root.querySelector(".tm-steps .now")?.style.setProperty("--p", pct + "%");
    if (Date.now() - lastUi > 300 || sim) {
      lastUi = Date.now();
      $(".tm-dist span").textContent = `${Math.round(d)}m 남았어 · 걸어서 약 ${walkMin(d)}분` + (heading == null ? " · 화살표는 지도 위쪽(북) 기준" : "");
    }
    // 도착 판정: 구역 안(정확도 OK)이거나 25m 이내
    // 실제로 걸을 때: 빨간 구역 안에 들어오거나 핀에서 25m 이내면 도착. 데모 걷기는 핀까지 끝까지 걸어간다
    const ev = geo.evaluate(p, zone);
    if ((!sim && ev.status === "inside") || d <= (sim ? 3 : 25)) return arrive();
    if (away) return;   // 사진·쓰다듬기 중엔 위치만 기록하고 말은 안 한다
    // 가는 길 멘트: 길의 1/4쯤 왔을 때, 그 길에서 보이는 건물·꿀팁 (장주연)
    if (!said.way && SCRIPT[wayKey] && d0 > 60 && d <= d0 * 0.8) { said.way = true; say(wayKey, SCRIPT[wayKey], "queue"); return; }
    if (!said.half && d0 > 80 && d <= d0 * 0.55) { said.half = true; HALF[zone.id] ? say("half-" + zone.id, HALF[zone.id], "queue") : say("halfway", "벌써 반이나 왔어!", "queue"); return; }
    if (!said.near && d0 > 90 && d <= 60) { said.near = true; say("near", `거의 다 왔어! 저 앞이 ${iya(zone.name)}`, "skip"); return; }
    if (!sim && d > minD + 30 && Date.now() - lastWrong > 20000) { lastWrong = Date.now(); say("wrong", "어, 반대쪽 같아! 화살표 방향으로 가 줘!"); return; }
    for (const poi of POIS) {
      if (!poiSaid.has(poi.name) && geo.distanceM(p, poi) < 35) { poiSaid.add(poi.name); bubble(poi.line); return; }
    }
  }

  let demoRunning = false, demoRaf = 0;   // 데모 걷기 중에는 실제 GPS를 무시

  // --- 실제 GPS ---
  let watchId = null, routedFromMe = false;
  if ("geolocation" in navigator) {
    watchId = navigator.geolocation.watchPosition((g) => {
      if (demoRunning) return;
      const p = { lat: g.coords.latitude, lng: g.coords.longitude, accuracy: g.coords.accuracy };
      if (p.accuracy > geo.MAX_ACCURACY) return;
      // 학교 근처(3km 이내)가 아니면 안내만 (집에서 켜 둔 채 학교로 와도, 처음 학교 근처에 들어온 순간부터 시작)
      if (geo.distanceM(p, zone) >= 3000) {
        $(".tm-dist span").textContent = DEMO ? "학교 밖이에요. 데모로 걷기를 눌러 보세요" : "학교 밖이에요. 캠퍼스에 오면 길 안내가 시작돼요";
        return;
      }
      // 학교 근처에서 처음 위치를 잡으면, 출발점(정문·이전 장소)과 60m 넘게 떨어져 있을 때 내 위치에서 길을 다시 찾는다
      if (!routedFromMe) { routedFromMe = true; if (geo.distanceM(p, prev) > 60) loadRoute(p); }
      onPos(p);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  }

  // --- 데모: 경로를 따라 자동으로 걸어가기 ---
  async function demoWalk() {
    if (demoRunning) return;
    demoRunning = true;
    await Promise.race([routeReady, new Promise((r) => setTimeout(r, 1500))]);
    const pts = route.length > 1 ? route : [prev, zone];
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = geo.distanceM(pts[i - 1], pts[i]); seg.push(l); total += l; }
    const dur = Math.max(15000, Math.min(25000, total * 40));   // 거리에 따라 15~25초 (대사가 끝까지 나오게)
    d0 = null; minD = Infinity;
    const t0 = performance.now();
    const step = (now) => {
      if (!mv || mv.root !== root) return;
      let k = Math.min(1, (now - t0) / dur) * total, i = 0;
      while (i < seg.length - 1 && k > seg[i]) { k -= seg[i]; i++; }
      const p = geo.lerp(pts[i], pts[i + 1], seg[i] ? Math.min(1, k / seg[i]) : 1);
      onPos({ ...p, accuracy: 5 }, { sim: true });
      if (!arrived && now - t0 < dur) demoRaf = requestAnimationFrame(step);
      else if (!arrived) { onPos({ lat: zone.lat, lng: zone.lng, accuracy: 5 }, { sim: true }); arrive(); }
    };
    demoRaf = requestAnimationFrame(step);
  }

  // --- 도착 ---
  function arrive() {
    if (arrived) return;
    if (away) { pendingArrive = true; return; }   // 사진·쓰다듬기 화면에 있으면 돌아온 뒤에 도착 처리
    arrived = true;
    demoRunning = false;
    cancelAnimationFrame(demoRaf);
    $('[data-a="pause"]')?.classList.add("hidden");   // 도착한 뒤엔 미션 화면이라 일시정지가 필요 없다
    navigator.vibrate?.([120, 60, 120]);
    root.querySelector(".tm-steps .now")?.style.setProperty("--p", "100%");
    $(".tm-dist span").textContent = "도착했어요!";
    walk.classList.remove("moving");
    walk.classList.add("arrived", "tm-arrive");
    const hob = walk.querySelector(".tm-hob");   // 도착하면 그 장소 호반우로
    if (hob) hob.src = mascot;
    setMoving(false);
    waiting = [];   // 아직 못 한 가는 길·중간 멘트는 버리고 도착 소개를 바로 다음에
    say("intro-" + zone.id, `도착! ${INTRO[zone.id] || zone.name + "에 왔어!"}`, "queue");
    paintBtns();
    map?.fit([zone], (zone.radius || 40) + 50);
    markVisited();
  }
  function markArrived() { const s = load(); if (s) { s.arrived = s.idx; save(s); } }
  // 투어로 도착했으니 그 장소 위치 인증은 끝난 것으로 처리 (나중에 장소 화면에 들어가면 바로 미션 메뉴)
  function markVisited() {
    markArrived();
    try {
      if (!app.store.isVerified(zone.id)) {
        app.store.setVerified(zone.id);
        if (app.store.grantBonus("arrive:" + zone.id, 10)) app.ui.reward(10);
      }
    } catch {}
  }
  function paintBtns() {
    const box = $(".tm-btns");
    const dn = tourDone(zone.id);
    // 걷는 중: [사진 찍기] + [도착했어요]  /  도착: 도착 미션 3칸(쓰다듬기·퀴즈·사진) + [다음 장소로]
    box.classList.toggle("arrived", arrived);
    box.innerHTML = arrived
      ? `<div class="tm-missions">
          <button class="tm-ms ${dn.pet ? "done" : ""}" data-t="pet"><b>${dn.pet ? "✓ " : ""}${HEART_ZONES.has(zone.id) ? "하트 그리기" : "친해지기"}</b><span>${dn.pet ? "완료" : "+10 XP"}</span></button>
          ${QUIZ[zone.id] ? `<button class="tm-ms ${dn.quiz ? "done" : ""}" data-t="quiz"><b>${dn.quiz ? "✓ " : ""}퀴즈</b><span>${dn.quiz ? "완료" : "+15 XP"}</span></button>` : ""}
          <button class="tm-ms ${dn.photo ? "done" : ""}" data-t="photo"><b>${dn.photo ? "✓ " : ""}사진</b><span>${dn.photo ? "완료" : "+10 XP"}</span></button>
        </div>
        <button class="primary" data-a="skip">${st.idx + 1 < c.stops.length ? "다음 장소로 →" : "완주하기"}</button>`
      : `<button class="sub" data-t="photo">사진 찍기</button><button class="primary" data-a="here">도착했어요</button>`;
    box.querySelector('[data-t="photo"]').onclick = doPhoto;
    box.querySelector('[data-t="pet"]')?.addEventListener("click", doPet);
    box.querySelector('[data-t="quiz"]')?.addEventListener("click", doQuiz);
    // 데모로 걷기는 지도 위 작은 버튼으로 (관리자 "데모 모드"가 켜졌을 때만)
    const dm = $(".tm-demo");
    if (DEMO && !arrived && !dm) {
      const b = document.createElement("button");
      b.className = "tm-demo"; b.type = "button"; b.textContent = "▶ 데모로 걷기";
      b.onclick = () => { b.disabled = true; b.textContent = "걷는 중…"; demoWalk(); };
      $("#tour-map").appendChild(b);
    } else if (arrived) dm?.remove();
    box.querySelector('[data-a="skip"]')?.addEventListener("click", () => { markArrived(); closeMove(); next(zone); });   // 미션은 건너뛰고 투어 계속
    box.querySelector('[data-a="here"]')?.addEventListener("click", () => {
      // GPS가 부정확할 때를 위한 수동 도착 (100m 안이거나 위치를 모를 때만)
      if (lastPos && geo.distanceM(lastPos, zone) > 100) { say("far", "아직 좀 멀어! 화살표를 따라 조금만 더 가 줘!"); return; }
      arrive();
    });
  }
  paintBtns();

  mv = {
    root,
    stop() {
      demoRunning = false;
      cancelAnimationFrame(demoRaf);
      clearInterval(arrowTimer);
      clearInterval(moveTimer);
      clearInterval(lineTimer);
      bgm.stop();
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener("deviceorientationabsolute", onOri);
      window.removeEventListener("deviceorientation", onOri);
      try { wake?.release(); } catch {}
      try { map?.destroy(); } catch {}   // 음성은 끊지 않는다 (도착 소개를 들으며 미션 화면으로 넘어가도 되게)
    },
  };

  // 출발 안내
  const fromName = prev.name || "";
  if (first) say("start-" + c.id, `안녕! 나는 호반우야. ${fromName}에서 출발해서 ${c.name}를 같이 돌아 보자! 첫 번째 장소는 ${iya(zone.name)}.`);
  else say("next-" + zone.id, `다음은 ${zone.name}! ${zone.desc ? zone.desc + "." : ""} 지도 따라 같이 가 보자`);
}

/* ---------------- 완주 ---------------- */
function finish(st) {
  const c = course(st?.course);
  save(null);
  if (!c) return;
  injectStyle();
  const mins = Math.max(1, Math.round((Date.now() - (st.startedAt || Date.now())) / 60000));
  const first = app.store.grantBonus("tour:" + c.id, 100);
  if (first) app.ui.reward(100);
  const newBadge = giveBadge(c.id);
  const el = document.createElement("div");
  el.id = "tour-sheet";
  el.innerHTML = `<div class="ts" style="text-align:center">
    <h3>${c.emoji} ${c.name} 완주!</h3>
    ${badgeHtml(c, getBadges()[c.id], true)}
    <p class="ts-sub" style="margin:0 0 6px;font-weight:800;color:var(--primary,#d4121a)">${newBadge ? `🏅 '${c.badge}' 뱃지를 받았어요!` : "이미 받은 뱃지예요"} · 도감 탭에서 볼 수 있어요</p>
    <p class="ts-sub">${c.stops.length}곳을 ${mins}분 동안 함께 돌았어요.${first ? " 완주 보너스 100 XP!" : ""}</p>
    <div class="r" style="font-size:var(--fs-sm, 13px);line-height:1.8;margin-bottom:12px">정문 → ${c.stops.map((id) => zoneById(id)?.name || id).join(" → ")}</div>
    <button class="ts-close" style="background:var(--primary,#d4121a);color:#fff">좋아!</button></div>`;
  document.body.appendChild(el);
  el.querySelector(".ts-close").onclick = () => { el.remove(); try { app.goTab("home"); } catch {} };
  playKey("finish-" + c.id, `${c.name} 완주! ${c.badge} 뱃지를 받았어. 같이 돌아서 즐거웠어!`);
}