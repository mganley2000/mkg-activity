import { marked } from "marked";
import DOMPurify from "dompurify";
import { formatDayLabel, formatLocalTime12hWithSeconds } from "./dayList";

export type PanelMode =
  | { kind: "idle" }
  | { kind: "create"; day: string }
  | { kind: "edit"; day: string; id: number; lastEditedAtIso: string };

export type NotesPanelCallbacks = {
  onDraftInput: (value: string) => void;
  onToggleMarkup: (show: boolean) => void;
  onSave: () => void;
};

let purify: (html: string) => string = (h) => h;

export function initMarkdown(): void {
  marked.setOptions({ gfm: true, breaks: true });
  purify = DOMPurify.sanitize;
}

const HELP_MODAL_HTML = `
<div class="notes-modal-backdrop" id="np-help-modal" hidden aria-hidden="true">
  <div class="notes-modal" role="dialog" aria-modal="true" aria-labelledby="np-help-title" tabindex="-1">
    <div class="notes-modal-header">
      <h3 id="np-help-title">Markdown formatting</h3>
      <button type="button" class="notes-modal-close" id="np-help-close" aria-label="Close">×</button>
    </div>
    <div class="notes-modal-body">
      <p class="notes-help-intro">Your notes support <strong>GitHub Flavored Markdown</strong>. Common patterns:</p>
      <ul class="notes-help-list">
        <li><span class="notes-help-label">Headings</span> <code># H1</code> … <code>###### H6</code></li>
        <li><span class="notes-help-label">Bold</span> <code>**text**</code> or <code>__text__</code></li>
        <li><span class="notes-help-label">Italic</span> <code>*text*</code> or <code>_text_</code></li>
        <li><span class="notes-help-label">Bold + italic</span> <code>***text***</code></li>
        <li><span class="notes-help-label">Strikethrough</span> <code>~~text~~</code></li>
        <li><span class="notes-help-label">Inline code</span> <code>\`code\`</code></li>
        <li><span class="notes-help-label">Code block</span> wrap lines with <code>\`\`\`</code> (optionally add a language after the first fence)</li>
        <li><span class="notes-help-label">Link</span> <code>[label](https://example.com)</code></li>
        <li><span class="notes-help-label">Image</span> <code>![alt text](https://example.com/image.png)</code></li>
        <li><span class="notes-help-label">Blockquote</span> lines starting with <code>&gt;</code></li>
        <li><span class="notes-help-label">Bullet list</span> <code>- item</code> or <code>* item</code></li>
        <li><span class="notes-help-label">Numbered list</span> <code>1. first</code> <code>2. second</code></li>
        <li><span class="notes-help-label">Task list</span> <code>- [ ] todo</code> and <code>- [x] done</code></li>
        <li><span class="notes-help-label">Horizontal rule</span> a line with <code>---</code> or <code>***</code></li>
        <li><span class="notes-help-label">Line break</span> end a line with two spaces, or leave a blank line between paragraphs</li>
      </ul>
    </div>
  </div>
</div>
`;

function ensureHelpModal(): HTMLElement {
  let backdrop = document.getElementById("np-help-modal");
  if (backdrop) return backdrop;

  const tpl = document.createElement("template");
  tpl.innerHTML = HELP_MODAL_HTML.trim();
  backdrop = tpl.content.firstElementChild as HTMLElement;
  document.body.appendChild(backdrop);

  const closeBtn = backdrop.querySelector<HTMLButtonElement>("#np-help-close")!;

  function close(): void {
    backdrop!.setAttribute("hidden", "");
    backdrop!.setAttribute("aria-hidden", "true");
    document.body.classList.remove("notes-modal-open");
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape" && !backdrop!.hasAttribute("hidden")) {
      e.preventDefault();
      close();
    }
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  return backdrop;
}

/** Last edit time: relative if under 60 minutes, else local "08:53:20 PM". */
export function formatLastEditedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const minutes = Math.floor(ms / 60000);
  if (ms < 0) {
    return formatLocalTime12hWithSeconds(d);
  }
  if (minutes < 60) {
    if (minutes < 1) return "Less than a minute ago";
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  return formatLocalTime12hWithSeconds(d);
}

/** Local `yyyy-mm-dd` + 12-hour time with seconds and AM/PM. */
function formatLocalTimestampLine(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const timePart = formatLocalTime12hWithSeconds(d);
  return `${y}-${mo}-${day} ${timePart}`;
}

function openHelpModal(): void {
  const backdrop = ensureHelpModal();
  backdrop.removeAttribute("hidden");
  backdrop.setAttribute("aria-hidden", "false");
  document.body.classList.add("notes-modal-open");
  const closeBtn = backdrop.querySelector<HTMLButtonElement>("#np-help-close");
  closeBtn?.focus();
}

export function mountNotesPanel(
  container: HTMLElement,
  mode: PanelMode,
  draft: string,
  showMarkup: boolean,
  saving: boolean,
  status: string | null,
  statusIsError: boolean,
  callbacks: NotesPanelCallbacks
): void {
  if (mode.kind === "idle") {
    container.innerHTML = `<p class="empty-hint">Select a day on the left, or an empty day to create an activity.</p>`;
    return;
  }

  const dateHeading = formatDayLabel(mode.day);
  const titleLine =
    mode.kind === "create" ? "New activity" : formatLastEditedLabel(mode.lastEditedAtIso);

  container.innerHTML = `
    <header class="notes-panel-header">
      <p class="notes-panel-date">${escapeHtml(dateHeading)}</p>
      <h2 class="notes-panel-title">${escapeHtml(titleLine)}</h2>
    </header>
    <div class="notes-toolbar">
      <div class="notes-toolbar-left">
        <button type="button" class="notes-datestamp-btn" id="np-insert-date" aria-label="Insert date and time at top" title="Insert timestamp at top (YYYY-MM-DD hh:mm:ss AM/PM)">
          <svg class="notes-datestamp-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <button type="button" class="primary" id="np-save" ${saving ? "disabled" : ""}>Save</button>
      </div>
      <div class="notes-toolbar-right">
        <button
          type="button"
          class="notes-markup-toggle"
          id="np-markup"
          role="switch"
          aria-checked="${showMarkup ? "true" : "false"}"
          aria-label="Rendered markdown"
          title="Toggle rendered markdown preview"
        >
          <span class="notes-markup-toggle-track" aria-hidden="true"><span class="notes-markup-toggle-thumb"></span></span>
          <span class="notes-markup-toggle-label">Markdown</span>
        </button>
        <button type="button" class="notes-help-btn" id="np-help" aria-label="Markdown formatting help" title="Markdown help">
          <span class="notes-help-icon" aria-hidden="true">?</span>
        </button>
      </div>
    </div>
    <div class="notes-editor-region">
      <textarea class="notes-textarea" id="np-ta" ${showMarkup ? "hidden" : ""}>${escapeHtml(draft)}</textarea>
      <div class="notes-preview" id="np-prev" ${showMarkup ? "" : "hidden"}></div>
    </div>
    <p class="notes-status${statusIsError ? " is-error" : ""}" id="np-status" ${status ? "" : "hidden"}>${status ? escapeHtml(status) : ""}</p>
    <div id="tag-mount"></div>
  `;

  const ta = container.querySelector<HTMLTextAreaElement>("#np-ta")!;
  const prev = container.querySelector<HTMLElement>("#np-prev")!;
  const markupToggle = container.querySelector<HTMLButtonElement>("#np-markup")!;
  const saveBtn = container.querySelector<HTMLButtonElement>("#np-save")!;
  const insertDateBtn = container.querySelector<HTMLButtonElement>("#np-insert-date");
  const helpBtn = container.querySelector<HTMLButtonElement>("#np-help");
  const statusEl = container.querySelector<HTMLElement>("#np-status")!;

  function syncPreview(): void {
    const rawHtml = marked.parse(ta.value, { async: false }) as string;
    prev.innerHTML = purify(rawHtml);
  }

  if (showMarkup) {
    syncPreview();
  }

  function isMarkupPreviewOn(): boolean {
    return markupToggle.getAttribute("aria-checked") === "true";
  }

  ta.addEventListener("input", () => {
    callbacks.onDraftInput(ta.value);
    if (isMarkupPreviewOn()) syncPreview();
  });

  markupToggle.addEventListener("click", () => {
    const on = markupToggle.getAttribute("aria-checked") !== "true";
    markupToggle.setAttribute("aria-checked", on ? "true" : "false");
    ta.hidden = on;
    prev.hidden = !on;
    if (on) syncPreview();
    callbacks.onToggleMarkup(on);
  });

  function triggerSave(): void {
    callbacks.onSave();
  }

  saveBtn.addEventListener("click", () => {
    triggerSave();
  });

  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      triggerSave();
    }
  });

  insertDateBtn?.addEventListener("click", () => {
    const line = formatLocalTimestampLine();
    const before = ta.value;
    const next = before === "" ? `${line}\n\n` : `${line}\n\n${before}`;
    ta.value = next;
    callbacks.onDraftInput(next);
    if (isMarkupPreviewOn()) syncPreview();
    const caretBelowStamp = line.length + 1;
    ta.focus();
    ta.scrollTop = 0;
    ta.setSelectionRange(caretBelowStamp, caretBelowStamp);
    const editorRegion = ta.closest(".notes-editor-region");
    if (editorRegion instanceof HTMLElement) {
      editorRegion.scrollTop = 0;
    }
    requestAnimationFrame(() => {
      ta.scrollTop = 0;
      ta.setSelectionRange(caretBelowStamp, caretBelowStamp);
      if (editorRegion instanceof HTMLElement) {
        editorRegion.scrollTop = 0;
      }
    });
  });

  helpBtn?.addEventListener("click", () => {
    openHelpModal();
  });

  if (status) {
    statusEl.hidden = false;
    statusEl.textContent = status;
    statusEl.classList.toggle("is-error", statusIsError);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getTagMount(container: HTMLElement): HTMLElement | null {
  return container.querySelector("#tag-mount");
}
