import * as api from "./api";
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
  calendarDays = await api.fetchCalendar(30);
}

async function boot(): Promise<void> {
  initMarkdown();
  await loadCalendar();
  renderDayColumn();
  renderNotes();
}

void boot();
