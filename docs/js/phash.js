// 사진의 "대략적인 생김새"를 64비트 해시로 만든다 (average hash 방식).
// 완전히 똑같거나 거의 비슷한 사진인지 비교할 때 쓴다 — Gemini를 부르지 않고도
// 공짜로, 즉시 판별할 수 있어서 "같은 사진을 여러 미션에 재사용하는" 뻔한 경우를
// AI 호출 전에 걸러낸다.

function toImage(photo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 못 읽었어요"));
    img.src = typeof photo === "string" ? photo : URL.createObjectURL(photo);
  });
}

// 8x8 흑백으로 축소 → 평균 밝기보다 밝은 칸은 1, 어두운 칸은 0 → 64자리 '0'/'1' 문자열
export async function computeAHash(photo) {
  const img = await toImage(photo);
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  return gray.map((v) => (v >= avg ? "1" : "0")).join("");
}

// 두 해시가 몇 비트나 다른지 (0에 가까울수록 거의 같은 사진)
export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}