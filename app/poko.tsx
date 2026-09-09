"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { SunMedium, Moon, Plus, Bell, CloudCheck, CloudOff, ChevronLeft, ChevronRight, Clock3, Check, CalendarDays, Sparkles, Monitor, Smartphone, PictureInPicture2, GripHorizontal, X, Pencil, Trash2, Play, Pause, RotateCcw, CircleHelp, ArrowUpRight, LoaderCircle, ShieldCheck, CheckCheck, ListTodo, ExternalLink, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { localDate, shiftDate, sortTasks, isDue, type Task } from "@/lib/task-model";

type Tab = "pending" | "upcoming" | "completed";
type PipWindow = Window & { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } };
type Draft = { title: string; note: string; date: string; time: string };
const blankDraft = (): Draft => ({ title: "", note: "", date: localDate(), time: "" });
const encouragements = ["One less thing on your mind. One more reason to feel proud.", "You showed up and made it happen. Keep that lovely momentum.", "Small steps add up to big things. This one counts.", "Take a breath and enjoy this little win. You earned it."];

function timeLabel(value: number) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function shortDate(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }); }
function monday(value: string) { const day = new Date(value + "T12:00:00").getDay(); return shiftDate(value, -((day + 6) % 7)); }
function reminderKey(task: Task) { return task.id + ":" + task.starts_at; }

export default function Poko() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState(0);
  const [date, setDate] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [syncDraft, setSyncDraft] = useState("");
  const [syncSetup, setSyncSetup] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", note: "", date: "", time: "" });
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [reward, setReward] = useState<Task | null>(null);
  const [rewardMessage, setRewardMessage] = useState(encouragements[0]);
  const [help, setHelp] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [soundOn, setSoundOn] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [reminders, setReminders] = useState<Task[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [pip, setPip] = useState<Window | null>(null);
  const [mini, setMini] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 120 });
  const [timezone, setTimezone] = useState("");
  const writing = useRef(false);
  const epoch = useRef(0);
  const loadSequence = useRef(0);
  const draftId = useRef("");
  const notified = useRef(new Set<string>());
  const pipRef = useRef<Window | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const previousToday = useRef("");
  const today = now ? localDate(new Date(now)) : "";

  useEffect(() => {
    if (!today) return;
    if (previousToday.current && previousToday.current !== today && date === previousToday.current) {
      setDate(today); setWeekStart(monday(today));
    }
    previousToday.current = today;
  }, [today, date]);

  const reload = useCallback(async () => {
    if (!syncKey) { setLoading(false); return null; }
    if (writing.current) return null;
    const sequence = ++loadSequence.current, started = epoch.current;
    try {
      const response = await fetch("/api/tasks", { cache: "no-store", headers: { "X-Poko-Key": syncKey }, signal: AbortSignal.timeout(12000) });
      if (response.status === 401) { setSyncSetup(true); throw new Error("Enter your Poko sync code."); }
      if (!response.ok) throw new Error("Couldn’t sync your tasks. Check your connection and try again.");
      const data = await response.json() as { tasks: Task[] };
      if (!Array.isArray(data.tasks)) throw new Error("Couldn’t load your tasks. Please sign in again.");
      if (!writing.current && started === epoch.current && sequence === loadSequence.current) {
        setTasks(data.tasks); setSyncError(""); setLastSync(Date.now());
      }
      return data.tasks;
    } catch (error) {
      if (sequence === loadSequence.current) setSyncError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Sync took too long. Please try again.");
      return null;
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [syncKey]);

  useEffect(() => {
    setNow(Date.now()); const day = localDate(); setDate(day); setWeekStart(monday(day));
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setNotificationPermission("Notification" in window ? Notification.permission : "unavailable");
    const savedKey = localStorage.getItem("poko-sync-key") ?? "";
    setSyncKey(savedKey); setSyncDraft(savedKey); setSyncSetup(!savedKey);
    setSoundOn(localStorage.getItem("poko-sound") === "on");
    const savedTheme = localStorage.getItem("poko-theme");
    const dark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(dark); document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { notified.current = new Set(JSON.parse(sessionStorage.getItem("poko-reminded") || "[]")); } catch { /* Device preference is optional. */ }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    void reload();
    const timer = window.setInterval(() => { setNow(Date.now()); void reload(); }, 10000);
    const wake = () => { setNow(Date.now()); void reload(); };
    const online = () => { void reload(); };
    const offline = () => setSyncError("You’re offline. Your saved tasks will sync when you reconnect.");
    window.addEventListener("focus", wake); window.addEventListener("online", online); window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", wake);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", wake); window.removeEventListener("online", online); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", wake); pipRef.current?.close(); };
  }, [reload]);

  const playTune = useCallback((kind: "reminder" | "complete" | "preview") => {
    if (!soundOn && kind !== "preview") return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContext.current ?? new AudioContextClass();
      audioContext.current = context;
      if (context.state === "suspended") void context.resume();
      const start = context.currentTime + 0.04;
      const notes = kind === "reminder"
        ? [{ f: 523.25, t: 0, d: .42 }, { f: 659.25, t: .5, d: .42 }, { f: 783.99, t: 1, d: .78 }]
        : [{ f: 659.25, t: 0, d: .28 }, { f: 783.99, t: .3, d: .28 }, { f: 1046.5, t: .62, d: .75 }];
      notes.forEach(({ f, t, d }, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = index === 2 ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(f, start + t);
        gain.gain.setValueAtTime(.0001, start + t);
        gain.gain.exponentialRampToValueAtTime(index === 2 ? .075 : .05, start + t + .035);
        gain.gain.exponentialRampToValueAtTime(.0001, start + t + d);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start + t); oscillator.stop(start + t + d + .04);
      });
    } catch { /* The in-app reminder remains available if audio is blocked. */ }
  }, [soundOn]);

  async function setSound(enabled: boolean) {
    setSoundOn(enabled); localStorage.setItem("poko-sound", enabled ? "on" : "off");
    if (enabled) { playTune("preview"); toast.success("Calm reminder tunes are on."); }
    else toast("Reminder tunes are off.");
  }

  function setTheme(dark: boolean) {
    setDarkMode(dark); localStorage.setItem("poko-theme", dark ? "dark" : "light"); document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  useEffect(() => {
    if (!now || loading || syncError) return;
    const due = tasks.filter(task => isDue(task, now) && !notified.current.has(reminderKey(task)) && (!snoozed[task.id] || snoozed[task.id] <= now)).sort(sortTasks);
    if (!due.length) return;
    due.forEach(task => notified.current.add(reminderKey(task)));
    try { sessionStorage.setItem("poko-reminded", JSON.stringify([...notified.current].slice(-500))); } catch { /* Optional per-tab acknowledgement. */ }
    setReminders(current => [...current, ...due.filter(task => !current.some(item => item.id === task.id))]);
    playTune("reminder");
    if ("Notification" in window && Notification.permission === "granted") {
      const title = due.length > 1 ? `${due.length} tasks are ready to start` : "A little nudge from Poko";
      const options = { body: due[0].title + (due.length > 1 ? ` + ${due.length - 1} more` : " — ready when you are."), icon: "/icon-192.png", tag: "poko-start", data: { url: "/" } };
      const show = async () => {
        try { const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
          if (registration?.active) await registration.showNotification(title, options);
          else { const notification = new Notification(title, options); notification.onclick = () => { window.focus(); notification.close(); }; }
        } catch { /* In-app reminder remains visible when system alerts are unavailable. */ }
      };
      void show();
    }
  }, [tasks, now, loading, syncError, snoozed, playTune]);

  async function mutate(task: Task | null, method: "POST" | "PATCH" | "DELETE", payload: unknown) {
    if (writing.current) throw new Error("Please wait for your last change to finish.");
    writing.current = true; epoch.current++; setBusy(task?.id || "new");
    let conflict = false;
    try {
      const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", { method, headers: { "Content-Type": "application/json", "X-Poko-Key": syncKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => ({ error: "Please sign in again or retry your change." }));
      if (response.status === 401) setSyncSetup(true);
      if (!response.ok) { conflict = response.status === 409 || response.status === 404; throw new Error(data.error || "Couldn’t save. Please try again."); }
      if (method === "DELETE") setTasks(current => current.filter(t => t.id !== task?.id));
      else setTasks(current => [...current.filter(t => t.id !== data.task.id), data.task]);
      setLastSync(Date.now()); setSyncError("");
      return data.task as Task | undefined;
    } finally {
      writing.current = false; epoch.current++; setBusy("");
      if (conflict) {
        const latest = await reload();
        if (latest && task) setEditing(current => current?.id === task.id ? { ...current, version: latest.find(t => t.id === task.id)?.version ?? current.version } : current);
      }
    }
  }

  function saveSyncKey(event: FormEvent) {
    event.preventDefault();
    const value = syncDraft.trim();
    if (value.length < 6) { setFormError("Use at least 6 characters for your private sync code."); return; }
    localStorage.setItem("poko-sync-key", value); setSyncKey(value); setSyncError(""); setFormError(""); setLoading(true); setSyncSetup(false);
    toast.success("This device is connected to your Poko tasks.");
  }

  function openNew() {
    draftId.current = crypto.randomUUID(); setEditing(null); setDraft({ ...blankDraft(), date: date || localDate() }); setFormError(""); setEditor(true);
  }
  function openEdit(task: Task) {
    setEditing(task); setFormError("");
    const start = task.starts_at !== null ? new Date(task.starts_at) : null;
    setDraft({ title: task.title, note: task.note, date: start ? localDate(start) : task.task_date, time: start ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}` : "" });
    setEditor(true);
  }
  async function saveTask(event: FormEvent) {
    event.preventDefault(); setFormError("");
    if (!draft.title.trim() || !draft.date) { setFormError("Add a task name and a date."); return; }
    const starts = draft.time ? new Date(`${draft.date}T${draft.time}`).getTime() : null;
    if (starts !== null && !Number.isFinite(starts)) { setFormError("Choose a valid start time."); return; }
    try {
      const fields = { title: draft.title.trim(), note: draft.note.trim(), task_date: draft.date, starts_at: starts };
      await mutate(editing, editing ? "PATCH" : "POST", editing ? { ...fields, version: editing.version } : { ...fields, id: draftId.current });
      setEditor(false); setDate(draft.date); setWeekStart(monday(draft.date)); setTab("pending");
      toast.success(editing ? "Task updated" : "A little plan, saved.");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Couldn’t save. Please try again."); }
  }
  async function changeStatus(task: Task, status: Task["status"]) {
    setActionError("");
    try {
      const saved = await mutate(task, "PATCH", { status, version: task.version });
      setReminders(current => current.filter(t => t.id !== task.id));
      if (status === "completed" && saved) { playTune("complete"); setRewardMessage(encouragements[Math.floor(Math.random() * encouragements.length)]); setReward(saved); }
      else if (status === "pending") toast.success("Back on your list.");
    } catch (error) { const message = error instanceof Error ? error.message : "Couldn’t update this task."; setActionError(message); toast.error(message); }
  }
  async function deleteTask() {
    if (!deleting) return;
    try { await mutate(deleting, "DELETE", { version: deleting.version }); setReminders(current => current.filter(t => t.id !== deleting.id)); setDeleting(null); toast.success("Task deleted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn’t delete this task."); }
  }
  async function enableNotifications() {
    if (!("Notification" in window)) { setNotificationPermission("unavailable"); toast.info("This browser doesn’t support system alerts. In-app reminders still work."); return; }
    try {
      const permission = await Notification.requestPermission(); setNotificationPermission(permission);
      if (permission === "granted") toast.success("Desktop reminders are on while Poko is running.");
      else toast.info("In-app reminders are on. You can allow system alerts in your browser’s site settings.");
    } catch { toast.info("Open Poko in its own browser tab to allow notifications."); }
  }
  async function floatWidget() {
    if (pipRef.current && !pipRef.current.closed) { pipRef.current.focus(); return; }
    const api = (window as PipWindow).documentPictureInPicture;
    if (!api) { setMini(true); setHelp(true); return; }
    try {
      const floating = await api.requestWindow({ width: 355, height: 440 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => floating.document.head.appendChild(node.cloneNode(true)));
      floating.document.title = "Poko — Focus"; floating.document.body.className = "pip-body";
      pipRef.current = floating; setPip(floating); setMini(false);
      floating.addEventListener("pagehide", () => { pipRef.current = null; setPip(null); }, { once: true });
    } catch { setMini(true); toast.info("A movable widget is open on this page. For always-on-top, open the app directly in desktop Chrome or Edge."); }
  }
  function dragStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y }; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function dragMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const bounds = floatingRef.current?.getBoundingClientRect();
    setPosition({ x: Math.max(8, Math.min(window.innerWidth - (bounds?.width ?? 320) - 8, drag.current.left + event.clientX - drag.current.x)), y: Math.max(8, Math.min(window.innerHeight - (bounds?.height ?? 300) - 8, drag.current.top + event.clientY - drag.current.y)) });
  }
  function snooze(task: Task) {
    notified.current.delete(reminderKey(task)); setSnoozed(current => ({ ...current, [task.id]: Date.now() + 10 * 60000 })); setReminders(current => current.filter(t => t.id !== task.id));
    try { sessionStorage.setItem("poko-reminded", JSON.stringify([...notified.current])); } catch { /* Optional preference. */ }
    toast("I’ll nudge you again in 10 minutes while the app is open.");
  }

  const pending = tasks.filter(t => t.status !== "completed" && (t.task_date === date || (date === today && t.task_date < today))).sort(sortTasks);
  const upcoming = tasks.filter(t => t.status !== "completed" && t.task_date > today).sort(sortTasks);
  const completed = tasks.filter(t => t.status === "completed").sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0));
  const todayTasks = tasks.filter(t => t.task_date === today);
  const doneToday = todayTasks.filter(t => t.status === "completed").length;
  const percentage = todayTasks.length ? Math.round(doneToday / todayTasks.length * 100) : 0;
  const focusTasks = tasks.filter(t => t.status !== "completed" && t.task_date <= today).sort(sortTasks);
  const focus = focusTasks[0] || upcoming[0];
  const list = tab === "pending" ? pending : tab === "upcoming" ? upcoming : completed;
  const currentReminder = reminders.map(r => tasks.find(t => t.id === r.id)).find((t): t is Task => !!t && isDue(t, now));
  const greeting = !now ? "Hello" : new Date(now).getHours() < 12 ? "Good morning" : new Date(now).getHours() < 18 ? "Good afternoon" : "Good evening";
  const hasData = !loading && !syncError;

  function widget(isFloating = false) {
    const widgetReward = isFloating ? reward : null;
    return <div className="widget">
      <div className="widget-top"><div className="widget-brand"><SunMedium /> Poko <span className="text-muted">/ focus</span></div><div className="row" style={{ gap: 3 }}>
        {isFloating ? <span className={`sync-label ${syncError ? "offline" : ""}`} title={syncError || "Tasks saved"}>{syncError ? <CloudOff /> : <CloudCheck />}</span> : <button className="icon-button" onClick={floatWidget} aria-label="Open floating task widget"><ArrowUpRight /></button>}
      </div></div>
      {widgetReward ? <div className="widget-reward" role="status"><img src="/celebration.png" alt="A smiling iridescent glass star with sparkling confetti" /><h2>You did it!</h2><p>{rewardMessage}</p><button className="primary full" onClick={() => setReward(null)}>Keep the glow going <Sparkles /></button></div> : <>
        <span className="widget-kicker">{focus?.status === "active" ? "In your flow" : focus ? "Your next little step" : "A little room to focus"}</span>
        <h3 className="widget-task">{loading ? "Getting your tasks…" : syncError && !tasks.length ? "Let’s reconnect" : focus?.title || "What’s your first small step?"}</h3>
        <div className="widget-time"><Clock3 />{focus ? focus.starts_at !== null ? `${focus.task_date !== today ? shortDate(focus.task_date) + " · " : ""}${timeLabel(focus.starts_at)}` : focus.task_date === today ? "Any time today" : shortDate(focus.task_date) + " · Any time" : "One task at a time."}</div>
        {isFloating && actionError && <div className="error-banner" role="alert" style={{ marginTop: 10 }}>{actionError}</div>}
        {isFloating && currentReminder && <div className="reminder-card"><span>Time to start</span><strong>{currentReminder.title}</strong><button className="quiet" disabled={!!busy} onClick={() => changeStatus(currentReminder, "active")}>Start now <Play /></button><button className="quiet" onClick={() => snooze(currentReminder)}>10 min later</button></div>}
        {isFloating && focusTasks.length > 1 && <div className="widget-mini-list">{focusTasks.slice(1, 5).map(t => <div className="widget-mini-row" key={t.id}><Checkbox className="task-check" checked={false} disabled={!!busy} aria-label={`Complete ${t.title}`} onCheckedChange={() => changeStatus(t, "completed")} /><span>{t.title}</span>{t.starts_at !== null && <small>{timeLabel(t.starts_at)}</small>}</div>)}</div>}
        <div className="widget-actions">{focus ? <><button className="primary" disabled={!!busy} onClick={() => changeStatus(focus, "completed")}><Check /> Complete task</button><button className="secondary" disabled={!!busy} title={focus.status === "active" ? "Pause task" : "Start task"} aria-label={focus.status === "active" ? "Pause task" : "Start task"} onClick={() => changeStatus(focus, focus.status === "active" ? "pending" : "active")}>{focus.status === "active" ? <Pause /> : <Play />}</button></> : <button className="primary full" disabled={!hasData} onClick={() => { if (isFloating && pipRef.current) { pipRef.current.close(); window.focus(); } openNew(); }}><Plus /> Add a task</button>}</div>
        <div className="widget-next"><span>{focusTasks.length} pending today</span><span>{doneToday} done <CheckCheck style={{ display: "inline", width: 14, height: 14, marginLeft: 4 }} /></span></div>
      </>}
    </div>;
  }

  function renderTask(task: Task) {
    const done = task.status === "completed", overdue = task.task_date < today;
    return <article className={`task-row ${done ? "completed" : ""}`} key={task.id}>
      <Checkbox className="task-check" checked={done} disabled={!!busy} onCheckedChange={() => changeStatus(task, done ? "pending" : "completed")} aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`} />
      <div className="task-info"><p className="task-title">{task.title}</p><div className="task-meta">
        <span className="time-meta">{task.starts_at !== null ? <><Clock3 />{timeLabel(task.starts_at)}</> : <><CalendarDays />Any time</>}</span>
        {(task.task_date !== date || tab !== "pending") && <span>· {shortDate(task.task_date)}</span>}
        {task.status === "active" && <span className="tag active"><Play size={10} />In progress</span>}
        {!done && overdue && <span className="tag due">Carried over</span>}
        {isDue(task, now) && !overdue && <span className="tag due">Ready to start</span>}
        {done && <span className="tag active">Completed</span>}
      </div>{task.note && <p className="task-note">{task.note}</p>}</div>
      <div className="task-tools">
        {!done && <button className="icon-button" disabled={!!busy} title={task.status === "active" ? "Pause task" : "Start task"} aria-label={`${task.status === "active" ? "Pause" : "Start"} ${task.title}`} onClick={() => changeStatus(task, task.status === "active" ? "pending" : "active")}>{busy === task.id ? <LoaderCircle className="spin" /> : task.status === "active" ? <Pause /> : <Play />}</button>}
        <button className="icon-button" disabled={!!busy} onClick={() => openEdit(task)} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil /></button>
        <button className="icon-button" disabled={!!busy} onClick={() => setDeleting(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 /></button>
      </div>
    </article>;
  }

  return <><div className="app-scene" /><div className="shell">
    <header className="topbar"><div className="brand"><span className="brand-icon"><SunMedium /></span>poko</div><div className="top-actions">
      <span className={`sync-label header-sync ${syncError ? "offline" : ""}`} aria-live="polite">{syncError ? <CloudOff /> : busy || loading ? <LoaderCircle className="spin" /> : <CloudCheck />}{syncError ? "Waiting to sync" : busy ? "Saving…" : loading ? "Connecting…" : "All changes saved"}</span>
      <button className="secondary" onClick={floatWidget}><PictureInPicture2 /><span className="float-label">Float widget</span></button>
      <button className="icon-button" onClick={() => setTheme(!darkMode)} aria-label={darkMode ? "Use light mode" : "Use night mode"} title={darkMode ? "Light mode" : "Night mode"}>{darkMode ? <SunMedium /> : <Moon />}</button>
      <button className="icon-button sound-button" onClick={() => void setSound(!soundOn)} aria-label={soundOn ? "Turn reminder tunes off" : "Turn reminder tunes on"} title={soundOn ? "Tunes on" : "Tunes off"}>{soundOn ? <Volume2 /> : <VolumeX />}</button>
      <button className="icon-button" onClick={() => setHelp(true)} aria-label="Reminder and device settings"><Bell /></button><button className="avatar" aria-label="Change private sync code" title="Change sync code" onClick={() => { setSyncDraft(syncKey); setSyncSetup(true); }}>EH</button>
    </div></header>
    <div className="page-heading"><div><div className="eyebrow">MAKE YOUR DAY COUNT</div><h1 className="greeting">{greeting}, Emran <span className="sun-dot">✦</span></h1><p className="heading-sub">A clear mind starts with a little plan.</p></div><button className="primary" disabled={!date || !syncKey} onClick={openNew}><Plus /> Add task</button></div>
    {syncError && <div className="error-banner" role="alert"><span>{syncError}</span>{!syncKey ? <button onClick={() => setSyncSetup(true)}>Set sync code</button> : <button onClick={() => reload()}>Retry</button>}</div>}
    <main className="workspace"><section className="glass board" aria-label="Daily task planner">
      <div className="board-top"><h2 className="board-title">{date === today ? "Today’s plan" : date ? shortDate(date) + "’s plan" : "Your plan"}</h2><div className="row" style={{ gap: 8 }}><label className="date-control quiet"><CalendarDays size={15} /><span>{date ? new Date(date + "T12:00:00").toLocaleDateString("en", { month: "long", year: "numeric" }) : "Choose date"}</span><input type="date" value={date} aria-label="Choose a day to plan" onChange={event => { if (event.target.value) { setDate(event.target.value); setWeekStart(monday(event.target.value)); setTab("pending"); } }} /></label><div className="week-nav"><button className="icon-button" aria-label="Previous week" onClick={() => { setWeekStart(shiftDate(weekStart, -7)); setDate(shiftDate(date, -7)); setTab("pending"); }} disabled={!weekStart}><ChevronLeft /></button><button className="icon-button" aria-label="Next week" onClick={() => { setWeekStart(shiftDate(weekStart, 7)); setDate(shiftDate(date, 7)); setTab("pending"); }} disabled={!weekStart}><ChevronRight /></button></div></div></div>
      <div className="week">{Array.from({ length: 7 }, (_, index) => { const day = weekStart ? shiftDate(weekStart, index) : ""; return <button key={index} className={`day ${day === date ? "selected" : ""} ${day === today ? "today" : ""} ${tasks.some(t => t.task_date === day && t.status !== "completed") ? "has-tasks" : ""}`} aria-pressed={day === date} aria-label={day ? new Date(day + "T12:00:00").toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) : "Loading date"} onClick={() => { setDate(day); setTab("pending"); }} disabled={!day}><span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span><strong>{day ? new Date(day + "T12:00:00").getDate() : "–"}</strong></button>; })}</div>
      <Tabs value={tab} onValueChange={value => setTab(value as Tab)} className="task-tabs"><TabsList aria-label="Task views"><TabsTrigger value="pending">Pending <span className="tab-count">{pending.length}</span></TabsTrigger><TabsTrigger value="upcoming">Upcoming <span className="tab-count">{upcoming.length}</span></TabsTrigger><TabsTrigger value="completed">Completed <span className="tab-count">{completed.length}</span></TabsTrigger></TabsList>
        {(["pending", "upcoming", "completed"] as Tab[]).map(view => <TabsContent value={view} key={view}>{loading ? <div className="loading-row"><LoaderCircle className="spin" size={19} /> Bringing your plans together…</div> : list.length ? list.map(renderTask) : <Empty className="empty-task"><div className="empty-icon">{tab === "completed" ? <CheckCheck /> : tab === "upcoming" ? <CalendarDays /> : <ListTodo />}</div><EmptyHeader><EmptyTitle>{syncError ? "Your tasks are waiting" : tab === "completed" ? "Your wins will live here" : tab === "upcoming" ? "A little space for what’s next" : "A fresh page for your day"}</EmptyTitle><EmptyDescription>{syncError ? "Reconnect to load your saved plans." : tab === "completed" ? "Check off a task and give yourself a little credit." : tab === "upcoming" ? "Add a task with a future date to plan ahead." : "Add what’s on your mind. We’ll take it one task at a time."}</EmptyDescription></EmptyHeader>{tab !== "completed" && !syncError && <button className="secondary" onClick={openNew}><Plus /> {tab === "upcoming" ? "Plan a task" : "Add your first task"}</button>}</Empty>}</TabsContent>)}
      </Tabs><button className="add-row" onClick={openNew} disabled={!date || !syncKey}><Plus /> Add a little to-do…</button>
    </section>
    <aside className="aside"><section className="glass progress-card"><div className="panel-label">Your daily glow <Sparkles /></div><div className="progress-content"><div className="progress-ring" role="img" aria-label={`${percentage}% of today’s scheduled tasks completed`}><svg viewBox="0 0 88 88"><circle className="track" cx="44" cy="44" r="37" /><circle className="fill" cx="44" cy="44" r="37" strokeDasharray="232.48" strokeDashoffset={232.48 * (1 - percentage / 100)} /></svg><strong>{percentage}<span style={{ fontSize: 13 }}>%</span></strong></div><div className="progress-words"><strong>{doneToday} <span style={{ display: "inline", fontSize: 17, color: "#94aab0" }}>/ {todayTasks.length}</span></strong><span>today’s tasks complete</span></div></div><p className="small-note">{percentage === 100 && todayTasks.length ? "All done for today. Enjoy your well-earned pause." : doneToday ? "Look at you making progress. Every little win counts." : "No rush. Just one small step to get going."}</p></section>
      <section className="widget-preview-block"><div className="widget-section-label" style={{ marginBottom: 13 }}><span>Your desk companion</span><Monitor /></div>{widget()}<p className="widget-note">Keep a little focus beside whatever you’re doing.<br /><button onClick={floatWidget} style={{ color: "#327985", fontWeight: 600, marginTop: 5 }}>Open floating widget <ArrowUpRight style={{ width: 12, height: 12, display: "inline" }} /></button></p></section>
      <div className="device-note"><Smartphone /><div><strong>Your plans, wherever you are.</strong><p>Use the same private sync code on your phone and computer to see the same tasks.</p></div></div>
    </aside></main>
    <footer className="page-foot"><span><ShieldCheck /> Just for you <span style={{ margin: "0 5px" }}>·</span>{lastSync ? `Synced ${timeLabel(lastSync)}` : "Your private daily space"}</span><button className="quiet" onClick={() => setHelp(true)}><CircleHelp size={13} /> Devices & reminders</button><span>One thing at a time. You’ve got this.</span></footer>
  </div>

  <Dialog open={syncSetup} onOpenChange={value => { if (syncKey) setSyncSetup(value); }}><DialogContent className="glass-dialog"><DialogHeader><DialogTitle>Connect your Poko</DialogTitle><DialogDescription>Choose one private code and use the same code on your phone and computer. Keep it secret.</DialogDescription></DialogHeader><form className="task-form" onSubmit={saveSyncKey}><label className="field">Private sync code<input type="password" autoFocus value={syncDraft} onChange={event => setSyncDraft(event.target.value)} placeholder="At least 6 characters" minLength={6} maxLength={100} autoComplete="off" required /></label><p className="form-hint"><ShieldCheck /> Your code is turned into a one-way identifier before tasks are saved.</p>{formError && <div className="error-banner" role="alert">{formError}</div>}<button className="primary full" type="submit">Connect this device <CloudCheck /></button></form></DialogContent></Dialog>

  <Dialog open={editor} onOpenChange={value => { if (!busy) setEditor(value); }}><DialogContent className="glass-dialog"><DialogHeader><DialogTitle>{editing ? "A little change of plan" : "What’s on your mind?"}</DialogTitle><DialogDescription>{editing ? "Adjust your task and make room for your day." : "Give your next step a name and a time, if you like."}</DialogDescription></DialogHeader><form onSubmit={saveTask} className="task-form"><label className="field">Task name<input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Finish the client proposal" maxLength={200} required /></label><div className="field-grid"><label className="field">Day<input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} required /></label><label className="field">Start time <small>(optional)</small><input type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} aria-label="Task start time" />{draft.time && <button className="quiet" style={{ padding: 0, fontSize: 12, justifyContent: "flex-start" }} type="button" onClick={() => setDraft({ ...draft, time: "" })}>Clear time</button>}</label></div><label className="field">A little note <small>(optional)</small><textarea value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Anything you want to remember…" maxLength={2000} /></label><p className="form-hint"><Clock3 /> Times use {timezone || "your device’s time zone"}. Keep Poko open for start reminders; missed tasks appear when you return.</p>{formError && <div className="error-banner" role="alert">{formError}</div>}<div className="form-actions"><button className="quiet" type="button" disabled={!!busy} onClick={() => setEditor(false)}>Cancel</button><button type="submit" className="primary" disabled={!!busy}>{busy ? <LoaderCircle className="spin" /> : <Check />}{busy ? "Saving…" : editing ? "Save changes" : "Add to my day"}</button></div></form></DialogContent></Dialog>

  <Dialog open={!!reward && !pip && !mini} onOpenChange={open => { if (!open) setReward(null); }}><DialogContent className="glass-dialog celebration"><img className="celebration-image" src="/celebration.png" alt="A smiling glass star surrounded by sparkling confetti" /><div className="eyebrow">A LITTLE WIN, A LOVELY FEELING</div><DialogTitle>You did it!</DialogTitle><DialogDescription>{rewardMessage}</DialogDescription><div className="celebrated-task"><Check />{reward?.title}</div><div className="form-actions"><button className="primary" onClick={() => setReward(null)}>Keep the glow going <Sparkles /></button><button className="quiet" disabled={!!busy} onClick={async () => { if (reward) await changeStatus(reward, "pending"); setReward(null); }}><RotateCcw /> Completed by mistake? Undo</button></div></DialogContent></Dialog>

  <AlertDialog open={!!deleting} onOpenChange={value => { if (!value && !busy) setDeleting(null); }}><AlertDialogContent className="glass-dialog"><AlertDialogTitle>Remove this task?</AlertDialogTitle><AlertDialogDescription>“{deleting?.title}” will be removed from your devices.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>Keep task</AlertDialogCancel><AlertDialogAction className="danger" disabled={!!busy} onClick={event => { event.preventDefault(); void deleteTask(); }}>{busy ? "Removing…" : "Remove task"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

  <Dialog open={!!currentReminder && !editor && !reward && !help && !pip && !mini} onOpenChange={open => { if (!open && currentReminder) setReminders(current => current.filter(t => t.id !== currentReminder.id)); }}><DialogContent className="glass-dialog"><DialogHeader><DialogTitle>A little nudge <Bell style={{ display: "inline", width: 24, height: 24, color: "#438c96" }} /></DialogTitle><DialogDescription>Your planned start time is here. Ready for a small step?</DialogDescription></DialogHeader><div className="reminder-card"><strong>{currentReminder?.title}</strong><span>{currentReminder?.starts_at !== null && currentReminder?.starts_at !== undefined ? timeLabel(currentReminder.starts_at) : "Ready to start"}{reminders.length > 1 ? ` · ${reminders.length - 1} more waiting` : ""}</span></div><div className="form-actions"><button className="quiet" onClick={() => currentReminder && snooze(currentReminder)}>10 minutes later</button><button className="primary" disabled={!!busy} onClick={() => currentReminder && changeStatus(currentReminder, "active")}><Play /> Start task</button></div></DialogContent></Dialog>

  <Dialog open={help} onOpenChange={setHelp}><DialogContent className="glass-dialog"><DialogHeader><DialogTitle>A little help for your day</DialogTitle><DialogDescription>Your devices, reminders, and floating companion.</DialogDescription></DialogHeader><section className="help-section"><h3><PictureInPicture2 /> Keep tasks above your other windows</h3><p>Open Poko directly in desktop Chrome or Edge, then press <strong>Float widget</strong>. Drag the window by its title bar and resize it to suit your desk. Keep the original tab open.</p><p>On other browsers, the movable widget stays inside this page. Use the dotted handle or arrow keys to move it.</p><div className="inline-actions"><button className="secondary" onClick={() => { setHelp(false); void floatWidget(); }}>Float widget <ArrowUpRight /></button><button className="quiet" onClick={() => { setMini(true); setHelp(false); }}>On this page</button></div></section><section className="help-section"><h3><Bell /> Start-time reminders</h3><p>At the chosen time, Poko shows a reminder and plays a gentle three-note tune when sounds are enabled. Starting the task closes the reminder. System alerts also need permission.</p><div className="inline-actions"><button className="secondary" onClick={() => void setSound(!soundOn)}>{soundOn ? <Volume2 /> : <VolumeX />}{soundOn ? "Calm tunes on" : "Turn calm tunes on"}</button><button className="quiet" onClick={() => playTune("preview")}>Preview tune</button></div><button className="secondary" style={{ marginTop: 10 }} disabled={notificationPermission === "granted" || notificationPermission === "unavailable"} onClick={enableNotifications}>{notificationPermission === "granted" ? <Check /> : <Bell />}{notificationPermission === "granted" ? "System alerts enabled" : notificationPermission === "denied" ? "Check notification settings" : notificationPermission === "unavailable" ? "In-app reminders available" : "Enable system alerts"}</button>{notificationPermission === "denied" && <p style={{ marginTop: 8 }}>Allow notifications for this site in your browser’s site settings, then reload.</p>}</section><section className="help-section"><h3><Smartphone /> Add plans from your phone</h3><p>Open this same link on your phone and enter the same private Poko sync code. Saved tasks refresh on your computer within about 10 seconds.</p><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(window.location.origin); toast.success("App link copied"); } catch { toast.info("Copy this app’s address from your browser’s address bar."); } }}>Copy app link <ExternalLink /></button></section><section className="help-section"><h3><Monitor /> Open at the start of your day</h3><p>Add Poko to Chrome’s <strong>On startup → Open a specific page</strong> setting. It will open when Chrome starts. You’ll still need to press <strong>Float widget</strong> once each session.</p><p>To open the floating widget automatically when your computer starts, a desktop app is needed.</p></section><p className="small-note" style={{ margin: 0 }}>Times on this device: {timezone || "your local time zone"}. <a href="https://developer.chrome.com/docs/web-platform/document-picture-in-picture" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>About floating windows</a>.</p></DialogContent></Dialog>

  {pip && !pip.closed && createPortal(widget(true), pip.document.body)}
  {mini && !pip && <div className="floating-shell" ref={floatingRef} style={{ left: position.x, top: position.y }}><div className="widget" style={{ padding: 0 }}><button className="drag-bar" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={event => { const delta: Record<string, number[]> = { ArrowUp: [0, -12], ArrowDown: [0, 12], ArrowLeft: [-12, 0], ArrowRight: [12, 0] }; if (delta[event.key]) { event.preventDefault(); const [x, y] = delta[event.key]; const bounds = floatingRef.current?.getBoundingClientRect(); setPosition(p => ({ x: Math.max(8, Math.min(window.innerWidth - (bounds?.width ?? 320) - 8, p.x + x)), y: Math.max(8, Math.min(window.innerHeight - (bounds?.height ?? 300) - 8, p.y + y)) })); } }} aria-label="Move widget: drag or use arrow keys"><GripHorizontal /></button><button className="floating-close" aria-label="Close movable widget" onClick={() => setMini(false)}><X /></button>{widget(true)}</div></div>}
  <Toaster position="bottom-center" theme="light" richColors />
  </>;
}
