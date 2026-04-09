export type DayBucket = {
  date: string;
  activities: {
    id: number;
    notesPreview: string;
    createdAt: string;
    updatedAt: string;
    tags: { tg_id: number; vt_name: string }[];
  }[];
};

export type ActivityResponse = {
  id: number;
  pl_notes: string;
  ac_created_datetime: string;
  ac_updated_datetime: string;
  tags: { tg_id: number; vt_name: string }[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export async function fetchCalendar(days = 30): Promise<DayBucket[]> {
  const res = await fetch(`/api/days?days=${days}`);
  const data = await parseJson<{ days: DayBucket[] }>(res);
  return data.days;
}

export async function fetchActivity(id: number): Promise<ActivityResponse> {
  const res = await fetch(`/api/activities/${id}`);
  return parseJson<ActivityResponse>(res);
}

export async function createActivity(pl_notes: string, day?: string): Promise<ActivityResponse> {
  const res = await fetch("/api/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pl_notes, day }),
  });
  return parseJson<ActivityResponse>(res);
}

export async function updateActivity(id: number, pl_notes: string): Promise<ActivityResponse> {
  const res = await fetch(`/api/activities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pl_notes }),
  });
  return parseJson<ActivityResponse>(res);
}

export async function searchTags(q: string): Promise<{ tg_id: number; vt_name: string }[]> {
  const params = new URLSearchParams({ q });
  const res = await fetch(`/api/tags?${params}`);
  const data = await parseJson<{ tags: { tg_id: number; vt_name: string }[] }>(res);
  return data.tags;
}

export async function linkTag(activityId: number, body: { tg_id: number } | { vt_name: string }): Promise<void> {
  const res = await fetch(`/api/activities/${activityId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await parseJson<unknown>(res);
}

export async function unlinkTag(activityId: number, tgId: number): Promise<void> {
  const res = await fetch(`/api/activities/${activityId}/tags/${tgId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}
