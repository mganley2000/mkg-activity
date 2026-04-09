import type { ActivityResponse } from "../api";

const DEBOUNCE_MS = 280;

export type TagsCallbacks = {
  onAdd: (activityId: number, tg_id: number | undefined, vt_name: string | undefined) => void;
  onRemove: (activityId: number, tgId: number) => void;
};

export function mountTagsSection(
  mount: HTMLElement,
  activity: ActivityResponse | null,
  searchTags: (q: string) => Promise<{ tg_id: number; vt_name: string }[]>,
  callbacks: TagsCallbacks
): void {
  if (!activity) {
    mount.replaceChildren();
    mount.innerHTML = `<p class="empty-hint">Save the activity to add tags.</p>`;
    return;
  }

  const activityId = activity.id;
  const initialTags = activity.tags;

  mount.innerHTML = `
    <div class="tag-section">
      <h3>Tags</h3>
      <div class="tag-input-wrap">
        <input type="text" class="tag-input" id="tag-q" placeholder="Search or create tag…" autocomplete="off" />
        <ul class="tag-suggestions" id="tag-sug" hidden></ul>
      </div>
      <div class="tag-chips" id="tag-chips"></div>
    </div>
  `;

  const input = mount.querySelector<HTMLInputElement>("#tag-q")!;
  const sug = mount.querySelector<HTMLUListElement>("#tag-sug")!;
  const chips = mount.querySelector<HTMLElement>("#tag-chips")!;

  function renderChips(tags: ActivityResponse["tags"]): void {
    chips.replaceChildren();
    for (const t of tags) {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Remove tag");
      btn.dataset.tgid = String(t.tg_id);
      btn.textContent = "×";
      chip.appendChild(document.createTextNode(`${t.vt_name} `));
      chip.appendChild(btn);
      chips.appendChild(chip);
    }
    chips.querySelectorAll("button[data-tgid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tgId = Number((btn as HTMLButtonElement).dataset.tgid);
        if (Number.isInteger(tgId)) callbacks.onRemove(activityId, tgId);
      });
    });
  }

  renderChips(initialTags);

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener("input", () => {
    const q = input.value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!q.trim()) {
        sug.hidden = true;
        sug.replaceChildren();
        return;
      }
      try {
        const rows = await searchTags(q.trim());
        sug.replaceChildren();
        for (const row of rows) {
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = row.vt_name;
          b.addEventListener("click", () => {
            callbacks.onAdd(activityId, row.tg_id, undefined);
            input.value = "";
            sug.hidden = true;
          });
          li.appendChild(b);
          sug.appendChild(li);
        }
        if (rows.length === 0) {
          const li = document.createElement("li");
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = `Create “${q.trim()}”`;
          b.addEventListener("click", () => {
            callbacks.onAdd(activityId, undefined, q.trim());
            input.value = "";
            sug.hidden = true;
          });
          li.appendChild(b);
          sug.appendChild(li);
        }
        sug.hidden = false;
      } catch {
        sug.hidden = true;
      }
    }, DEBOUNCE_MS);
  });

}

