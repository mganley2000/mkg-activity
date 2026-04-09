import { dayKeyLocal } from "../../lib/dates";
import { formatDayLabel } from "./dayList";

export function todayLocalDayKey(): string {
  return dayKeyLocal(new Date());
}

/**
 * If `dateKey` is not today, shows a confirmation dialog. Resolves `true` if the user
 * confirms or if no warning is needed; `false` if cancelled.
 */
export function confirmPastDaySelection(dateKey: string): Promise<boolean> {
  if (dateKey === todayLocalDayKey()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const backdrop = ensurePastDayModal();
    const title = backdrop.querySelector<HTMLElement>("#past-day-title")!;
    const body = backdrop.querySelector<HTMLElement>("#past-day-body")!;
    const btnCancel = backdrop.querySelector<HTMLButtonElement>("#past-day-cancel")!;
    const btnContinue = backdrop.querySelector<HTMLButtonElement>("#past-day-confirm")!;
    const btnClose = backdrop.querySelector<HTMLButtonElement>("#past-day-close")!;

    const dayLabel = formatDayLabel(dateKey);
    title.textContent = "Open a different day?";
    body.innerHTML = `<p class="past-day-confirm-lead">You chose <strong>${escapeHtml(dayLabel)}</strong>, which is not today.</p>
<p class="past-day-confirm-warn">Logging or editing work on a past day can be misleading and may not match when the work actually happened. You can skew your timeline if dates do not reflect reality.</p>
<p class="past-day-confirm-q">Continue and add or edit an activity for this day?</p>`;

    let settled = false;

    function finish(confirmed: boolean): void {
      if (settled) return;
      settled = true;
      backdrop.setAttribute("hidden", "");
      backdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("notes-modal-open");
      document.removeEventListener("keydown", onDocKey);
      backdrop.removeEventListener("click", onBackdropClick);
      btnContinue.removeEventListener("click", onContinue);
      btnCancel.removeEventListener("click", onCancel);
      btnClose.removeEventListener("click", onCancel);
      resolve(confirmed);
    }

    function onDocKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    }

    function onBackdropClick(e: MouseEvent): void {
      if (e.target === backdrop) finish(false);
    }

    function onContinue(): void {
      finish(true);
    }

    function onCancel(): void {
      finish(false);
    }

    backdrop.removeAttribute("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("notes-modal-open");
    document.addEventListener("keydown", onDocKey);
    backdrop.addEventListener("click", onBackdropClick);
    btnContinue.addEventListener("click", onContinue);
    btnCancel.addEventListener("click", onCancel);
    btnClose.addEventListener("click", onCancel);

    btnContinue.focus();
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensurePastDayModal(): HTMLElement {
  let el = document.getElementById("past-day-confirm-modal");
  if (el) return el;

  const tpl = document.createElement("template");
  tpl.innerHTML = `
<div class="notes-modal-backdrop" id="past-day-confirm-modal" hidden aria-hidden="true">
  <div class="notes-modal" role="dialog" aria-modal="true" aria-labelledby="past-day-title" tabindex="-1">
    <div class="notes-modal-header">
      <h3 id="past-day-title"></h3>
      <button type="button" class="notes-modal-close" id="past-day-close" aria-label="Cancel">×</button>
    </div>
    <div class="notes-modal-body" id="past-day-body"></div>
    <div class="notes-modal-footer">
      <button type="button" id="past-day-cancel">Cancel</button>
      <button type="button" class="primary" id="past-day-confirm">Continue</button>
    </div>
  </div>
</div>
`.trim();
  el = tpl.content.firstElementChild as HTMLElement;
  document.body.appendChild(el);
  return el;
}
