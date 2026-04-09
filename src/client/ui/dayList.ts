import type { DayBucket } from "../api";

export type DayListHandlers = {
  onSelectNewActivityForDay: (dateKey: string) => void;
  onSelectActivity: (dateKey: string, activityId: number) => void;
};

export type DayListSelection = {
  activeDayKey: string | null;
  activeActivityId: number | null;
  /** Highlights the "New activity" row when in create mode for this day. */
  activeNewActivityDayKey: string | null;
};

export function renderDayList(
  container: HTMLElement,
  days: DayBucket[],
  selection: DayListSelection,
  handlers: DayListHandlers
): void {
  container.replaceChildren();

  const ordered = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const todayYear = new Date().getFullYear();

  for (let i = 0; i < ordered.length; i++) {
    const bucket = ordered[i]!;
    const { date, activities } = bucket;
    const block = document.createElement("div");
    block.className = "day-block";

    const showYearBoundary = shouldShowYearOnDayBoundary(i, ordered, todayYear);
    const label = formatDayLabel(date, { includeYear: showYearBoundary });
    const header = document.createElement("div");
    header.className =
      "day-multi-header" + (showYearBoundary ? " day-multi-header--year-boundary" : "");
    header.textContent = label;
    block.appendChild(header);

    const sorted = sortActivitiesNewestFirst(activities);

    for (const act of sorted) {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive =
        selection.activeDayKey === date && selection.activeActivityId === act.id;
      btn.className = "day-row day-row-nested" + (isActive ? " is-active" : "");
      const tagsBlock =
        act.tags.length > 0
          ? `<div class="day-list-tags" aria-label="Tags">${act.tags
              .map((t) => `<span class="day-list-tag">${escapeHtml(t.vt_name)}</span>`)
              .join("")}</div>`
          : "";
      btn.innerHTML = `<span class="day-meta">${escapeHtml(activityRowLabel(act.createdAt))}</span>${tagsBlock}`;
      btn.addEventListener("click", () => handlers.onSelectActivity(date, act.id));
      block.appendChild(btn);
    }

    const newBtn = document.createElement("button");
    newBtn.type = "button";
    const newIsActive = selection.activeNewActivityDayKey === date;
    newBtn.className = "day-row day-row-nested day-row-new" + (newIsActive ? " is-active" : "");
    newBtn.innerHTML = `<span class="day-meta">${escapeHtml("New activity")}</span>`;
    newBtn.addEventListener("click", () => handlers.onSelectNewActivityForDay(date));
    block.appendChild(newBtn);

    container.appendChild(block);
  }
}

function sortActivitiesNewestFirst<T extends { updatedAt: string }>(activities: T[]): T[] {
  return [...activities].sort((a, b) => {
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    return tb - ta;
  });
}

/** e.g. "08:53:20 PM" (12-hour, seconds, two-digit hour). */
export function formatLocalTime12hWithSeconds(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** e.g. "Activity 08:53:20 PM" (local created time). */
function activityRowLabel(createdAtIso: string): string {
  return `Activity ${formatCreatedTimeLabel(createdAtIso)}`;
}

function formatCreatedTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatLocalTime12hWithSeconds(d);
}

export type FormatDayLabelOptions = {
  /** When true: e.g. "WED 2025/12/31" (weekday uppercased, full YYYY/MM/DD). */
  includeYear?: boolean;
};

export function formatDayLabel(isoDate: string, options?: FormatDayLabelOptions): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  const wk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  if (options?.includeYear) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${wk.toUpperCase()} ${y}/${mm}/${dd}`;
  }
  return `${wk} ${m}/${d}`;
}

function dayKeyYear(dateKey: string): number | null {
  const y = Number(dateKey.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Newest-first list: show year on the first day that falls in an older calendar year than the row above (or first row if already before this year). */
function shouldShowYearOnDayBoundary(index: number, ordered: DayBucket[], todayYear: number): boolean {
  const y = dayKeyYear(ordered[index]!.date);
  if (y === null) return false;
  if (index === 0) {
    return y < todayYear;
  }
  const prevY = dayKeyYear(ordered[index - 1]!.date);
  if (prevY === null) return false;
  return y < prevY;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
