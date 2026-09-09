import { z } from "zod";

export const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid date.");
export const taskFields = z.object({
  title: z.string().trim().min(1, "Give your task a name.").max(200),
  note: z.string().trim().max(2000).default(""),
  task_date: validDate,
  starts_at: z.number().int().min(0).max(253402300799000).nullable(),
});
export const createTask = taskFields.extend({ id: z.string().uuid() });
export const updateTask = taskFields.partial().extend({
  version: z.number().int().positive(),
  status: z.enum(["pending", "active", "completed"]).optional(),
});
export type Task = {
  id: string; title: string; note: string; task_date: string; starts_at: number | null;
  status: "pending" | "active" | "completed"; completed_at: number | null;
  created_at: number; updated_at: number; version: number;
};
export function localDate(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDate(value: string, days: number) {
  const date = new Date(value + "T12:00:00"); date.setDate(date.getDate() + days); return localDate(date);
}
export function isDue(task: Task, now: number) {
  return task.status === "pending" && task.starts_at !== null && task.starts_at <= now;
}
export function sortTasks(a: Task, b: Task) {
  if (a.status === "active" && b.status !== "active") return -1;
  if (b.status === "active" && a.status !== "active") return 1;
  return a.task_date.localeCompare(b.task_date) || (a.starts_at ?? Infinity) - (b.starts_at ?? Infinity) || a.created_at - b.created_at;
}
