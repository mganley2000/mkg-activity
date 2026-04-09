import * as api from "./api";
import { inclusiveLocalDaySpan, MAX_CUSTOM_RANGE_INCLUSIVE_DAYS } from "../lib/dates";
import { renderDayList } from "./ui/dayList";
import { getTagMount, initMarkdown, mountNotesPanel, type PanelMode } from "./ui/notesPanel";
import { confirmPastDaySelection } from "./ui/pastDayConfirm";
import { mountTagsSection } from "./ui/tags";

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type RangeState =
  | { mode: "preset"; presetDays: 7 | 30 }
  | { mode: "custom"; from: string; to: string };

const RANGE_COOKIE = "mkg_calendar_range";
const RANGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function defaultRollingBounds(presetDays: 7 | 30): { from: string; to: string } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const to = localDateKey(end);
  const start = new Date(end);
  start.setDate(start.getDate() - (presetDays - 1));
  const from = localDateKey(start);
  return { from, to };
}

function readRangeCookie(): RangeState {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${RANGE_COOKIE}=([^;]*)`));
    if (!m) return { mode: "preset", presetDays: 7 };
    const raw = decodeURIComponent(m[1]!);
    const j = JSON.parse(raw) as { mode?: string; presetDays?: number; from?: string; to?: string };
    if (j.mode === "custom" && j.from && j.to && j.from <= j.to) {
      return { mode: "custom", from: j.from, to: j.to };
    }
    if (j.presetDays === 30) return { mode: "preset", presetDays: 30 };
    if (j.presetDays === 7) return { mode: "preset", presetDays: 7 };
  } catch {
    /* ignore */
  }
  return { mode: "preset", presetDays: 7 };
}

function writeRangeCookie(state: RangeState): void {
  const payload = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${RANGE_COOKIE}=${payload}; path=/; max-age=${RANGE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

let rangeState: RangeState = readRangeCookie();
if (rangeState.mode === "custom" && inclusiveLocalDaySpan(rangeState.from, rangeState.to) > MAX_CUSTOM_RANGE_INCLUSIVE_DAYS) {
  rangeState = { mode: "preset", presetDays: 30 };
  writeRangeCookie(rangeState);
}

/** Yellow calendar icon when the last custom apply exceeded the 2-year span limit. */
let rangeSpanLimitWarn = false;

let calendarDays: api.DayBucket[] = [];
let selectedDayKey: string | null = null;
let selectedActivityId: number | null = null;
let mode: "idle" | "create" | "edit" = "idle";
let createDayKey: string | null = null;
let currentActivity: api.ActivityResponse | null = null;
let draft = "";
let showMarkup = false;
let saving = false;
let status: string | null = null;
let statusIsError = false;

const dayListEl = document.getElementById("day-list")!;
const notesPanelEl = document.getElementById("notes-panel")!;
const fromInput = document.getElementById("day-range-from") as HTMLInputElement;
const toInput = document.getElementById("day-range-to") as HTMLInputElement;
const applyBtn = document.getElementById("day-range-apply") as HTMLButtonElement;
const pickerBtn = document.getElementById("day-range-picker") as HTMLButtonElement;
const pickerWrap = pickerBtn.closest(".day-range-picker-wrap") as HTMLElement;
const rangePopover = document.getElementById("day-range-popover") as HTMLElement;
const pickerSrLabel = document.getElementById("day-range-picker-label") as HTMLElement;
const presetBtns = [
  ...document.querySelectorAll<HTMLButtonElement>("#day-range-toolbar .day-range-preset[data-preset]"),
];

function isDayRangePopoverOpen(): boolean {
  return !rangePopover.hidden;
}

function setDayRangePopoverOpen(open: boolean): void {
  rangePopover.hidden = !open;
  pickerBtn.setAttribute("aria-expanded", open ? "true" : "false");
  pickerWrap.classList.toggle("is-open", open);
}

function closeDayRangePopover(): void {
  if (!isDayRangePopoverOpen()) return;
  setDayRangePopoverOpen(false);
}

function openDayRangePopover(): void {
  setDayRangePopoverOpen(true);
  window.setTimeout(() => toInput.focus(), 0);
}

function toggleDayRangePopover(): void {
  if (isDayRangePopoverOpen()) closeDayRangePopover();
  else openDayRangePopover();
}

function panelMode(): PanelMode {
  if (mode === "idle") return { kind: "idle" };
  if (mode === "create" && createDayKey) return { kind: "create", day: createDayKey };
  if (mode === "edit" && currentActivity) {
    const day = selectedDayKey ?? dayKeyFromIso(currentActivity.ac_created_datetime);
    return {
      kind: "edit",
      id: currentActivity.id,
      day,
      lastEditedAtIso: currentActivity.ac_updated_datetime,
    };
  }
  return { kind: "idle" };
}

function formatRangeSummary(): string {
  if (rangeState.mode === "custom") {
    return `${rangeState.from} to ${rangeState.to}`;
  }
  const b = defaultRollingBounds(rangeState.presetDays);
  return `${b.from} to ${b.to} (last ${rangeState.presetDays} days)`;
}

function buildNotesExportUrl(): string {
  if (rangeState.mode === "custom") {
    const p = new URLSearchParams({ from: rangeState.from, to: rangeState.to });
    return `/api/export/notes?${p}`;
  }
  return `/api/export/notes?days=${String(rangeState.presetDays)}`;
}

async function downloadNotesExportPdf(): Promise<void> {
  try {
    const res = await fetch(buildNotesExportUrl());
    if (!res.ok) {
      let msg = "Export failed";
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const cd = res.headers.get("Content-Disposition");
    let filename = "activity-notes.pdf";
    const m = cd?.match(/filename="([^"]+)"/);
    if (m?.[1]) filename = m[1];
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    window.alert(msg);
  }
}

function renderRangeToolbar(): void {
  for (const btn of presetBtns) {
    const d = btn.dataset.preset;
    const n = d === "7" || d === "30" ? Number(d) : 0;
    const active = rangeState.mode === "preset" && n === rangeState.presetDays;
    btn.classList.toggle("is-active", active);
  }
  if (rangeState.mode === "custom") {
    fromInput.value = rangeState.from;
    toInput.value = rangeState.to;
  } else {
    const b = defaultRollingBounds(rangeState.presetDays);
    fromInput.value = b.from;
    toInput.value = b.to;
  }
  const summary = formatRangeSummary();
  pickerBtn.title = rangeSpanLimitWarn
    ? `Range too long (max 2 years). Adjust dates and Apply, or pick a preset. Current: ${summary}`
    : `Custom date range — ${summary}`;
  pickerBtn.classList.toggle("is-custom", rangeState.mode === "custom");
  pickerBtn.classList.toggle("is-range-limit-warn", rangeSpanLimitWarn);
  pickerSrLabel.textContent =
    rangeState.mode === "custom"
      ? `Custom range ${rangeState.from} through ${rangeState.to}. Open calendar to change.`
      : "Pick a custom date range";
}

function wireDayRangeToolbar(): void {
  function clearRangeSpanLimitWarnIfNeeded(): void {
    if (!rangeSpanLimitWarn) return;
    rangeSpanLimitWarn = false;
    renderRangeToolbar();
  }
  fromInput.addEventListener("input", clearRangeSpanLimitWarnIfNeeded);
  toInput.addEventListener("input", clearRangeSpanLimitWarnIfNeeded);
  fromInput.addEventListener("change", clearRangeSpanLimitWarnIfNeeded);
  toInput.addEventListener("change", clearRangeSpanLimitWarnIfNeeded);

  pickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDayRangePopover();
  });
  rangePopover.addEventListener("click", (e) => e.stopPropagation());

  function isPointerInsideDayRangeUI(e: PointerEvent): boolean {
    const path = e.composedPath();
    return path.some((n) => n === pickerWrap || n === rangePopover || n === pickerBtn);
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!isDayRangePopoverOpen()) return;
      if (isPointerInsideDayRangeUI(e)) return;
      closeDayRangePopover();
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDayRangePopoverOpen()) {
      e.preventDefault();
      closeDayRangePopover();
      pickerBtn.focus();
    }
  });

  for (const btn of presetBtns) {
    btn.addEventListener("click", () => {
      closeDayRangePopover();
      const d = btn.dataset.preset;
      if (d !== "7" && d !== "30") return;
      rangeSpanLimitWarn = false;
      rangeState = { mode: "preset", presetDays: d === "7" ? 7 : 30 };
      writeRangeCookie(rangeState);
      renderRangeToolbar();
      void (async () => {
        await loadCalendar();
        renderDayColumn();
      })();
    });
  }
  applyBtn.addEventListener("click", () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to || from > to) return;
    if (inclusiveLocalDaySpan(from, to) > MAX_CUSTOM_RANGE_INCLUSIVE_DAYS) {
      rangeState = { mode: "preset", presetDays: 30 };
      writeRangeCookie(rangeState);
      rangeSpanLimitWarn = true;
      status = null;
      statusIsError = false;
      renderRangeToolbar();
      closeDayRangePopover();
      void (async () => {
        await loadCalendar();
        renderDayColumn();
        renderNotes();
      })();
      return;
    }
    rangeSpanLimitWarn = false;
    rangeState = { mode: "custom", from, to };
    writeRangeCookie(rangeState);
    renderRangeToolbar();
    closeDayRangePopover();
    void (async () => {
      await loadCalendar();
      renderDayColumn();
    })();
  });
}

function renderDayColumn(): void {
  renderDayList(
    dayListEl,
    calendarDays,
    {
      activeDayKey: selectedDayKey,
      activeActivityId: selectedActivityId,
      activeNewActivityDayKey: mode === "create" && createDayKey ? createDayKey : null,
    },
    {
      onSelectNewActivityForDay: (dateKey) => {
        void (async () => {
          if (mode === "create" && createDayKey === dateKey) return;
          if (!(await confirmPastDaySelection(dateKey))) return;
          mode = "create";
          createDayKey = dateKey;
          selectedDayKey = dateKey;
          selectedActivityId = null;
          currentActivity = null;
          draft = "";
          showMarkup = false;
          status = null;
          statusIsError = false;
          renderNotes();
          renderDayColumn();
        })();
      },
      onSelectActivity: (dateKey, activityId) => {
        void (async () => {
          if (mode === "edit" && selectedDayKey === dateKey && selectedActivityId === activityId) return;
          if (!(await confirmPastDaySelection(dateKey))) return;
          try {
            const a = await api.fetchActivity(activityId);
            mode = "edit";
            createDayKey = null;
            selectedDayKey = dateKey;
            selectedActivityId = activityId;
            currentActivity = a;
            draft = a.pl_notes;
            showMarkup = false;
            status = null;
            statusIsError = false;
            renderNotes();
            renderDayColumn();
          } catch (e) {
            status = e instanceof Error ? e.message : "Load failed";
            statusIsError = true;
            renderNotes();
          }
        })();
      },
    }
  );
}

function renderNotes(): void {
  const pm = panelMode();
  mountNotesPanel(notesPanelEl, pm, draft, showMarkup, saving, status, statusIsError, {
    onDraftInput: (v) => {
      draft = v;
    },
    onToggleMarkup: (s) => {
      showMarkup = s;
    },
    onSave: () => void saveActivity(),
  });

  const tagMount = getTagMount(notesPanelEl);
  if (!tagMount) return;

  if (mode === "edit" && currentActivity) {
    mountTagsSection(tagMount, currentActivity, api.searchTags, {
      onAdd: (activityId, tg_id, vt_name) => {
        void (async () => {
          try {
            await api.linkTag(activityId, tg_id !== undefined ? { tg_id } : { vt_name: vt_name! });
            const updated = await api.fetchActivity(activityId);
            if (selectedActivityId === activityId) {
              currentActivity = updated;
            }
            await loadCalendar();
            renderDayColumn();
            renderNotes();
          } catch (e) {
            status = e instanceof Error ? e.message : "Tag failed";
            statusIsError = true;
            renderNotes();
          }
        })();
      },
      onRemove: (activityId, tgId) => {
        void (async () => {
          try {
            await api.unlinkTag(activityId, tgId);
            const updated = await api.fetchActivity(activityId);
            if (selectedActivityId === activityId) {
              currentActivity = updated;
            }
            await loadCalendar();
            renderDayColumn();
            renderNotes();
          } catch (e) {
            status = e instanceof Error ? e.message : "Remove failed";
            statusIsError = true;
            renderNotes();
          }
        })();
      },
    });
  } else {
    mountTagsSection(tagMount, null, api.searchTags, {
      onAdd: () => {},
      onRemove: () => {},
    });
  }
}

async function saveActivity(): Promise<void> {
  if (mode === "idle") return;
  saving = true;
  status = null;
  statusIsError = false;
  renderNotes();

  try {
    if (mode === "create" && createDayKey) {
      const a = await api.createActivity(draft, createDayKey);
      currentActivity = a;
      mode = "edit";
      selectedActivityId = a.id;
      selectedDayKey = dayKeyFromIso(a.ac_created_datetime);
      createDayKey = null;
      draft = a.pl_notes;
      status = "Saved.";
    } else if (mode === "edit" && currentActivity) {
      const a = await api.updateActivity(currentActivity.id, draft);
      currentActivity = a;
      status = "Saved.";
    }
    await loadCalendar();
  } catch (e) {
    statusIsError = true;
    status = e instanceof Error ? e.message : "Save failed";
  } finally {
    saving = false;
    renderDayColumn();
    renderNotes();
  }
}

async function loadCalendar(): Promise<void> {
  if (rangeState.mode === "custom") {
    calendarDays = await api.fetchCalendar({
      kind: "range",
      from: rangeState.from,
      to: rangeState.to,
    });
  } else {
    calendarDays = await api.fetchCalendar({ kind: "rolling", days: rangeState.presetDays });
  }
}

async function boot(): Promise<void> {
  initMarkdown();
  wireDayRangeToolbar();
  const exportNotesBtn = document.getElementById("export-notes-pdf");
  if (exportNotesBtn) {
    exportNotesBtn.addEventListener("click", () => void downloadNotesExportPdf());
  }
  renderRangeToolbar();
  await loadCalendar();
  renderDayColumn();
  renderNotes();
}

void boot();
