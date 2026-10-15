// 랭킹 데이터 계층.
// 지금은 더미 참가자 + 내 점수를 섞어서 만든다.
// 나중에 Supabase 등을 붙일 때는 이 파일의 getRanking()만 서버 조회로 바꾸면 화면 코드는 그대로 쓸 수 있다.
import { getState } from "./storage.js";

const BOTS = [
  { name: "일청담오리", dept: "자연과학대학", score: 1380 },
  { name: "새벽도서관", dept: "IT대학", score: 1210 },
  { name: "북문치킨", dept: "공과대학", score: 1090 },
  { name: "학식러버", dept: "경영대학", score: 960 },
  { name: "잔디밭낮잠", dept: "인문대학", score: 870 },
  { name: "과잠수집가", dept: "사회과학대학", score: 790 },
  { name: "팔공산다람쥐", dept: "농업생명과학대학", score: 700 },
  { name: "복현동토박이", dept: "공과대학", score: 610 },
  { name: "신입생이에요", dept: "IT대학", score: 520 },
  { name: "동아리방장", dept: "사범대학", score: 430 },
  { name: "1교시지각생", dept: "경영대학", score: 340 },
  { name: "커피수혈중", dept: "인문대학", score: 250 },
  { name: "길치탐험가", dept: "자연과학대학", score: 160 },
];

// mode: "total"(개인) | "dept"(소속별 평균)
export async function getRanking(mode = "total") {
  const st = getState();
  const me = { name: st.profile.nickname, dept: st.profile.dept, score: st.score, me: true };
  const all = [...BOTS, me];

  if (mode === "dept") {
    const groups = new Map();
    all.forEach((p) => {
      const g = groups.get(p.dept) || { name: p.dept, sum: 0, count: 0, me: false };
      g.sum += p.score;
      g.count += 1;
      if (p.me) g.me = true;
      groups.set(p.dept, g);
    });
    return [...groups.values()]
      .map((g) => ({ name: g.name, sub: `${g.count}명 참여 · 평균`, score: Math.round(g.sum / g.count), me: g.me }))
      .sort((a, b) => b.score - a.score);
  }

  // 동점이면 더미(먼저 달성한 사람)를 위로
  return all
    .sort((a, b) => b.score - a.score || (a.me ? 1 : -1))
    .map((p) => ({ name: p.name, sub: p.dept, score: p.score, me: !!p.me }));
}
