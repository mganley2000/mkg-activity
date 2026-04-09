export type ActivityRow = {
  ac_id: number;
  pl_notes: string;
  ac_created_datetime: string;
  ac_updated_datetime: string;
  /** Local calendar day (YYYY-MM-DD) for grouping in the day list. */
  ac_calendar_day: string | null;
};

export type TagRow = {
  tg_id: number;
  vt_name: string;
};

export type ActivitySummary = {
  id: number;
  notesPreview: string;
  createdAt: string;
  updatedAt: string;
  tags: TagRow[];
};

export type DayBucket = {
  date: string;
  activities: ActivitySummary[];
};

export type ActivityDetail = ActivityRow & {
  tags: TagRow[];
};
