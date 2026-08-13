/* ============================================================
   Small UI kit: toasts + confirm modal, used in place of the
   native alert()/confirm() dialogs.
   ============================================================ */
(function (global) {
  "use strict";

  let toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("aria-live", "polite");
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  const ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };

  function toast(message, type) {
    type = type || "info";
    const container = ensureToastContainer();
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast-msg"></span>
      <button class="toast-close" aria-label="Chiudi">✕</button>
    `;
    el.querySelector(".toast-msg").textContent = message;
    const remove = () => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector(".toast-close").addEventListener("click", remove);
    container.appendChild(el);
    setTimeout(remove, 4200);
  }

  let confirmBackdrop = null;
  function ensureConfirmModal() {
    if (confirmBackdrop) return confirmBackdrop;
    confirmBackdrop = document.createElement("div");
    confirmBackdrop.className = "modal-backdrop";
    confirmBackdrop.hidden = true;
    confirmBackdrop.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3 id="confirm-modal-title"></h3>
        <p id="confirm-modal-message"></p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="confirm-modal-cancel"></button>
          <button class="btn btn-danger" id="confirm-modal-ok"></button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBackdrop);
    return confirmBackdrop;
  }

  function confirmDialog(opts) {
    opts = opts || {};
    const backdrop = ensureConfirmModal();
    backdrop.querySelector("#confirm-modal-title").textContent = opts.title || "Sei sicuro?";
    backdrop.querySelector("#confirm-modal-message").textContent = opts.message || "";
    const okBtn = backdrop.querySelector("#confirm-modal-ok");
    const cancelBtn = backdrop.querySelector("#confirm-modal-cancel");
    okBtn.textContent = opts.confirmLabel || "Conferma";
    cancelBtn.textContent = opts.cancelLabel || "Annulla";

    return new Promise((resolve) => {
      function cleanup(result) {
        backdrop.hidden = true;
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop.removeEventListener("click", onBackdropClick);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdropClick(e) { if (e.target === backdrop) cleanup(false); }
      function onKeydown(e) { if (e.key === "Escape") cleanup(false); }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop.addEventListener("click", onBackdropClick);
      document.addEventListener("keydown", onKeydown);
      backdrop.hidden = false;
      okBtn.focus();
    });
  }

  global.UI = { toast, confirmDialog };
})(window);
