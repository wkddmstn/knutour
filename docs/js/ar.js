// 포켓몬고 느낌의 "AR 캐릭터 만나기" — 진짜 공간 인식(평면 추적)은 아니고,
// 카메라 화면 위에 호반우를 화면 하단 고정 위치로 겹쳐 보여주는 방식입니다.
// 아이폰 사파리를 포함해 대부분 브라우저에서 추가 라이브러리 없이 바로 됩니다.

// title: 상단에 보여줄 문구, mascotSrc: 겹쳐 보일 마스코트 이미지 경로
export async function openArEncounter({ title = "호반우를 만났어요!", mascotSrc } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ar-overlay";
  overlay.innerHTML = `
    <video class="ar-video" autoplay playsinline muted></video>
    <div class="ar-stage"><img class="ar-mascot" src="${mascotSrc}" alt="호반우"></div>
    <div class="ar-top">
      <span class="ar-title">${title}</span>
      <button type="button" class="ar-close" aria-label="닫기">✕</button>
    </div>
    <div class="ar-bottom">
      <button type="button" class="ar-shutter" aria-label="촬영"></button>
    </div>
    <p class="ar-error hidden"></p>`;
  document.body.appendChild(overlay);

  const video = overlay.querySelector(".ar-video");
  const errEl = overlay.querySelector(".ar-error");
  let stream = null;

  const close = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  };
  overlay.querySelector(".ar-close").onclick = close;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
  } catch {
    errEl.textContent = "카메라를 쓸 수 없어요. 브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.";
    errEl.classList.remove("hidden");
  }

  // 찰칵: 지금 카메라 화면 + 화면에 보이는 위치 그대로 마스코트를 합성해서 사진으로 저장
  overlay.querySelector(".ar-shutter").onclick = () => {
    if (!stream || !video.videoWidth) return;
    const mascotImg = overlay.querySelector(".ar-mascot");
    const videoRect = video.getBoundingClientRect();
    const mascotRect = mascotImg.getBoundingClientRect();
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      mascotImg,
      (mascotRect.left - videoRect.left) * scaleX,
      (mascotRect.top - videoRect.top) * scaleY,
      mascotRect.width * scaleX,
      mascotRect.height * scaleY
    );

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "campus-quest-ar.png";
    a.click();
  };

  return close;
}