// 앱 디자인에 맞춘 확인 창 (브라우저 기본 confirm()/prompt() 대신).
// #modal과 같은 카드 모양이지만 따로 맨 위 층에 띄운다:
// 댓글 시트(#modal)나 투어·사진 화면처럼 이미 떠 있는 창 위에서도 확인을 받을 수 있게.
//
//   if (!(await confirmDialog({ title: "이 사진을 지울까요?", message: "이 기기에서만 지워져요", ok: "지우기", danger: true }))) return;
//   linkDialog(url)   // 링크 복사가 막힌 브라우저에서 직접 복사할 수 있게 보여 준다

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function open(inner, setup) {
  return new Promise((resolve) => {
    const layer = document.createElement("div");
    layer.className = "dialog-layer";
    layer.innerHTML = `<div class="modal-card pop-in dialog-card" role="alertdialog" aria-modal="true">${inner}</div>`;
    document.body.appendChild(layer);
    const done = (v) => {
      document.removeEventListener("keydown", onKey, true);
      layer.remove();
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
    document.addEventListener("keydown", onKey, true);
    layer.addEventListener("click", (e) => { if (e.target === layer) done(false); });   // 바깥을 누르면 취소
    setup(layer, done);
  });
}

// 확인 → true, 취소·바깥 누르기·Esc → false
export function confirmDialog({ title, message = "", ok = "확인", cancel = "취소", danger = false }) {
  return open(`
    <h2>${esc(title)}</h2>
    ${message ? `<p>${esc(message)}</p>` : ""}
    <div class="dialog-btns">
      <button type="button" class="btn alt" data-v="0">${esc(cancel)}</button>
      <button type="button" class="btn${danger ? " btn-danger" : ""}" data-v="1">${esc(ok)}</button>
    </div>`,
  (layer, done) => {
    layer.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => done(b.dataset.v === "1")));
    layer.querySelector('[data-v="1"]').focus();
  });
}

// 자동 복사가 안 될 때: 링크를 골라 두고 "복사" 버튼을 한 번 더 시도한다
export function linkDialog(url, { title = "링크를 복사해 주세요" } = {}) {
  return open(`
    <h2>${esc(title)}</h2>
    <input class="text-in dialog-link" readonly value="${esc(url)}" aria-label="링크">
    <div class="dialog-btns">
      <button type="button" class="btn alt" data-v="close">닫기</button>
      <button type="button" class="btn" data-v="copy">복사</button>
    </div>`,
  (layer, done) => {
    const input = layer.querySelector("input");
    input.focus();
    input.select();
    layer.querySelector('[data-v="close"]').onclick = () => done(false);
    layer.querySelector('[data-v="copy"]').onclick = async (e) => {
      input.select();
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; }
      catch { try { ok = document.execCommand("copy"); } catch {} }
      if (ok) { done(true); return; }
      e.target.textContent = "길게 눌러 복사해 주세요";
    };
  });
}
