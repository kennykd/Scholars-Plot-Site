"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn, openNativePicker } from "@/lib/utils";
import { AiSuggestionsButton } from "@/app/components/common/ai-suggestions-button";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { StudyReminderOffset, StudyReminderValueUnit, type Task } from "@/types";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type StudyTrack = {
  id: string;
  title: string;
  startDate: string;
  repeatEnabled: boolean;
  repeatEvery: number;
  repeatUnit: "days" | "weeks";
  time: string;
  focusMinutes: number;
  breakMinutes: number;
  totalPomodoro: number;
  notes: string;
  descriptionAsChecklist: boolean;
  attachments: File[];
};

type StudyTrackDraft = {
  title: string;
  start_date: string;
  repeat_enabled: boolean;
  repeat_every: number;
  repeat_unit: "days" | "weeks";
  time: string;
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  notes: string;
  description_as_checklist: boolean;
};

type StudyTrackDraftPreview = {
  tracks: StudyTrackDraft[];
  warnings?: string[];
  reasoning?: string;
  skippedAttachments?: {
    fileName: string;
    fileType: string;
    reason: string;
  }[];
};

function createEmptyTrack(title = ""): StudyTrack {
  return {
    id: crypto.randomUUID(),
    title,
    startDate: "",
    repeatEnabled: false,
    repeatEvery: 1,
    repeatUnit: "weeks",
    time: "15:00",
    focusMinutes: 25,
    breakMinutes: 5,
    totalPomodoro: 2,
    notes: "",
    descriptionAsChecklist: false,
    attachments: [],
  };
}

const combineDateTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours);
  next.setMinutes(minutes);
  next.setSeconds(0, 0);
  return next;
};

const parseStudyTrackDate = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const localDateValue = (date = new Date()) => format(date, "yyyy-MM-dd");

type RepeatControlsProps = {
  idPrefix: string;
  checked: boolean;
  every: number;
  unit: "days" | "weeks";
  disabled?: boolean;
  label: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
  onEveryChange: (value: number) => void;
  onUnitChange: (unit: "days" | "weeks", every: number) => void;
};

function RepeatControls({
  idPrefix,
  checked,
  every,
  unit,
  disabled = false,
  label,
  description,
  onCheckedChange,
  onEveryChange,
  onUnitChange,
}: RepeatControlsProps) {
  const repeatEveryId = `${idPrefix}-repeat-every`;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="font-mono text-xs tracking-wider">REPEAT</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-repeat-enabled`}
            checked={checked}
            disabled={disabled}
            onCheckedChange={(next) => onCheckedChange(next === true)}
          />
          <Label
            htmlFor={`${idPrefix}-repeat-enabled`}
            className="font-mono text-xs tracking-wider"
          >
            {label}
          </Label>
        </div>
      </div>

      {checked ? (
        <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-2">
          <div className="space-y-1.5">
            <Label
              htmlFor={repeatEveryId}
              className="font-mono text-xs tracking-wider"
            >
              REPEAT EVERY
            </Label>
            <Input
              id={repeatEveryId}
              type="number"
              min={1}
              max={unit === "days" ? 30 : 12}
              value={every}
              disabled={disabled}
              onChange={(event) => onEveryChange(Number(event.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs tracking-wider">UNIT</Label>
            <div
              role="group"
              aria-label="Repeat unit"
              className="grid grid-cols-2 gap-1"
            >
              <Button
                type="button"
                size="sm"
                variant={unit === "days" ? "default" : "outline"}
                disabled={disabled}
                aria-pressed={unit === "days"}
                onClick={() =>
                  onUnitChange(
                    "days",
                    Math.min(Math.max(1, Number(every) || 1), 30),
                  )
                }
              >
                Days
              </Button>
              <Button
                type="button"
                size="sm"
                variant={unit === "weeks" ? "default" : "outline"}
                disabled={disabled}
                aria-pressed={unit === "weeks"}
                onClick={() =>
                  onUnitChange(
                    "weeks",
                    Math.min(Math.max(1, Number(every) || 1), 12),
                  )
                }
              >
                Weeks
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function StudyNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get("taskId");
  const taskId = taskIdParam ? Number(taskIdParam) : null;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalPomodoro, setTotalPomodoro] = useState(2);
  const [descriptionAsChecklist, setDescriptionAsChecklist] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminders, setReminders] = useState<StudyReminderOffset[]>([
    { unit: "minutes", value: 15 },
    { unit: "minutes", value: 5 },
    { unit: "minutes", value: 0, atStart: true },
  ]);
  // Standalone-form only: optional task link + batch-style repeat.
  const [selectedTaskId, setSelectedTaskId] = useState<string>("none");
  const [taskOptions, setTaskOptions] = useState<Task[]>([]);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<"days" | "weeks">("weeks");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskContext, setTaskContext] = useState<Task | null>(null);
  const [taskLoading, setTaskLoading] = useState(Boolean(taskId));
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<StudyTrack[]>([createEmptyTrack()]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [studyDraftLoading, setStudyDraftLoading] = useState(false);
  const [studyDraft, setStudyDraft] = useState<StudyTrackDraftPreview | null>(null);

  useEffect(() => {
    if (!taskId || !Number.isInteger(taskId) || taskId <= 0) {
      setTaskLoading(false);
      return;
    }

    let isMounted = true;
    setTaskLoading(true);

    fetch(`/api/task/${taskId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message ?? "Could not load task");
        }
        return data?.task as Task;
      })
      .then((task) => {
        if (!isMounted) return;
        setTaskContext(task);
        setTitle(task.title);
        setNotes(task.description ?? "");
        setTracks((currentTracks) => {
          if (currentTracks.length !== 1 || currentTracks[0].title.trim()) {
            return currentTracks;
          }
          return [{ ...currentTracks[0], title: task.title }];
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setTaskLoadError(error instanceof Error ? error.message : "Could not load task");
      })
      .finally(() => {
        if (isMounted) setTaskLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // The standalone form (no task in the URL) lets the user optionally link a task.
  useEffect(() => {
    if (taskId) return;

    let isMounted = true;
    fetch("/api/task")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message ?? "Could not load tasks");
        return (data?.tasks as Task[]) ?? [];
      })
      .then((tasks) => {
        if (isMounted) setTaskOptions(tasks);
      })
      .catch(() => {
        // Linking a task is optional, so a failed fetch is non-fatal.
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const totalMinutesComputed =
    (Math.max(1, Number(focusMinutes) || 0) +
      Math.max(1, Number(breakMinutes) || 0)) *
    Math.max(1, Number(totalPomodoro) || 0);

  const normalizedReminders = reminders.filter(() => reminderEnabled);
  const reminderOffsetsInMinutes = normalizedReminders.map((reminder) => {
    if (reminder.atStart) return 0;
    const value = Math.max(1, Number(reminder.value) || 1);
    return reminder.unit === "hours" ? value * 60 : value;
  });

  const selectedTask = useMemo(
    () => taskOptions.find((task) => String(task.id) === selectedTaskId) ?? null,
    [selectedTaskId, taskOptions],
  );

  const handleStandaloneTaskSelect = (taskIdValue: string) => {
    setSelectedTaskId(taskIdValue);
    setTaskPickerOpen(false);

    if (taskIdValue === "none") {
      setRepeatEnabled(false);
    }
  };

  const taskDeadline = useMemo(() => {
    if (!taskContext?.deadline) return null;
    const deadline = new Date(taskContext.deadline);
    return Number.isNaN(deadline.getTime()) ? null : deadline;
  }, [taskContext]);

  const taskDeadlineDateValue = useMemo(() => {
    const deadline = taskContext?.deadline;
    if (typeof deadline === "string" && /^\d{4}-\d{2}-\d{2}/.test(deadline)) {
      return deadline.slice(0, 10);
    }
    return taskDeadline ? format(taskDeadline, "yyyy-MM-dd") : null;
  }, [taskContext, taskDeadline]);

  const updateTrack = (trackId: string, updates: Partial<StudyTrack>) => {
    setPlannerError(null);
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, ...updates } : track)),
    );
  };

  const addTrack = () => {
    setPlannerError(null);
    setTracks((prev) => [...prev, createEmptyTrack()]);
  };

  const removeTrack = (trackId: string) => {
    setPlannerError(null);
    setTracks((prev) =>
      prev.length === 1 ? prev : prev.filter((track) => track.id !== trackId),
    );
  };

  const validateTracks = () => {
    if (!taskDeadline || !taskId) {
      setPlannerError("Task deadline is required before planning sessions");
      return false;
    }

    for (const track of tracks) {
      if (!track.title.trim()) {
        setPlannerError("Each study session needs a topic");
        return false;
      }
      if (!track.startDate) {
        setPlannerError("Choose a start date for each study session");
        return false;
      }
      if (!track.time) {
        setPlannerError("Choose a preferred time for each study session");
        return false;
      }
    }

    setPlannerError(null);
    return true;
  };

  const uploadTrackAttachments = async (
    createdByPlan: Record<string, number[]>,
  ) => {
    const failures: string[] = [];

    for (const track of tracks) {
      const studySessionIds = createdByPlan[track.id] ?? [];
      if (studySessionIds.length === 0 || track.attachments.length === 0) {
        continue;
      }

      for (const file of track.attachments) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("studySessionIds", JSON.stringify(studySessionIds));

        const response = await fetch("/api/study/attachment", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) failures.push(file.name);
      }
    }

    return failures;
  };

  const saveGeneratedSessions = async () => {
    if (!taskId) return;
    if (!validateTracks()) {
      return;
    }

    setSavingBatch(true);
    try {
      const response = await fetch("/api/study/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          reminder_enabled: reminderEnabled,
          reminders: reminderEnabled ? reminderOffsetsInMinutes : [],
          plans: tracks.map((track) => {
            const repeatEvery = Math.max(
              1,
              Math.min(
                track.repeatUnit === "days" ? 30 : 12,
                Math.round(Number(track.repeatEvery) || 1),
              ),
            );

            return {
              client_plan_id: track.id,
              title: track.title.trim(),
              start_date: track.startDate,
              repeat_enabled: track.repeatEnabled,
              repeat_every: repeatEvery,
              repeat_unit: track.repeatUnit,
              time: track.time,
              focus_minutes: Math.max(1, Number(track.focusMinutes) || 25),
              break_minutes: Math.max(0, Number(track.breakMinutes) || 0),
              total_pomodoros: Math.max(1, Number(track.totalPomodoro) || 1),
              notes: track.notes.trim() || undefined,
              description_as_checklist: track.descriptionAsChecklist,
            };
          }),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const firstError =
          data?.errors && typeof data.errors === "object"
            ? Object.values(data.errors).flat()[0]
            : null;
        throw new Error(firstError ?? data?.message ?? "Failed to create sessions");
      }

      const uploadFailures = await uploadTrackAttachments(data?.createdByPlan ?? {});
      if (uploadFailures.length > 0) {
        toast.warning(
          `Study sessions created. Some files failed: ${uploadFailures.join(", ")}`,
        );
      } else {
        toast.success("Study sessions created");
      }
      router.push(`/tasks/${taskId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create sessions";
      setPlannerError(message);
      toast.error(message);
    } finally {
      setSavingBatch(false);
    }
  };

  const updateReminder = (
    index: number,
    updates: Partial<StudyReminderOffset>,
  ) => {
    setReminders((prev) =>
      prev.map((reminder, reminderIndex) =>
        reminderIndex === index ? { ...reminder, ...updates } : reminder,
      ),
    );
  };

  const addReminder = () => {
    setReminders((prev) => [...prev, { unit: "minutes", value: 10 }]);
  };

  const toggleStartReminder = (index: number, checked: boolean) => {
    setReminders((prev) =>
      prev.map((reminder, reminderIndex) => {
        if (reminderIndex !== index) return reminder;

        if (checked) {
          return { ...reminder, atStart: true, value: 0 };
        }

        return {
          ...reminder,
          atStart: false,
          value: reminder.value === 0 ? 1 : reminder.value,
        };
      }),
    );
  };

  const removeReminder = (index: number) => {
    setReminders((prev) =>
      prev.filter((_, reminderIndex) => reminderIndex !== index),
    );
  };

  const getAcceptedFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" exceeds 10MB and was skipped`);
        continue;
      }
      accepted.push(file);
    }
    return accepted;
  };

  const addTrackFiles = (trackId: string, incoming: FileList | File[]) => {
    const accepted = getAcceptedFiles(incoming);
    if (accepted.length === 0) return;
    updateTrack(trackId, {
      attachments: [
        ...(tracks.find((track) => track.id === trackId)?.attachments ?? []),
        ...accepted,
      ],
    });
  };

  const removeTrackFile = (trackId: string, fileIndex: number) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              attachments: track.attachments.filter((_, index) => index !== fileIndex),
            }
          : track,
      ),
    );
  };

  const requestStudyTrackDraft = async () => {
    if (!taskId || !taskContext) return;

    setStudyDraftLoading(true);
    setPlannerError(null);
    try {
      const response = await fetch("/api/ai/study-track-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Could not generate study plan");
      }

      setStudyDraft(data.draft);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not generate study plan";
      setPlannerError(message);
      toast.error(message);
    } finally {
      setStudyDraftLoading(false);
    }
  };

  const applyStudyTrackDraft = () => {
    if (!studyDraft?.tracks?.length) return;

    setTracks(
      studyDraft.tracks.map((track) => ({
        id: crypto.randomUUID(),
        title: track.title,
        startDate: track.start_date,
        repeatEnabled: track.repeat_enabled,
        repeatEvery: track.repeat_every,
        repeatUnit: track.repeat_unit,
        time: track.time,
        focusMinutes: track.focus_minutes,
        breakMinutes: track.break_minutes,
        totalPomodoro: track.total_pomodoros,
        notes: track.notes,
        descriptionAsChecklist: track.description_as_checklist,
        attachments: [],
      })),
    );
    setPlannerError(null);
    toast.success("AI study plan applied");
  };

  const applyStudyTrackToSingleSession = (track: StudyTrackDraft) => {
    setTitle(track.title);
    setNotes(track.notes);
    setScheduledTime(track.time);
    setFocusMinutes(track.focus_minutes);
    setBreakMinutes(track.break_minutes);
    setTotalPomodoro(track.total_pomodoros);
    setDescriptionAsChecklist(track.description_as_checklist);
    setRepeatEnabled(track.repeat_enabled);
    setRepeatEvery(track.repeat_every);
    setRepeatUnit(track.repeat_unit);

    const draftDate = parseStudyTrackDate(track.start_date);
    if (draftDate) setScheduledDate(draftDate);
  };

  const buildSingleStudyDraftPayload = () => ({
    ...(selectedTask ? { taskId: selectedTask.id } : {}),
    title: title.trim(),
    notes: notes.trim(),
    scheduledDate: scheduledDate ? localDateValue(scheduledDate) : null,
    scheduledTime: scheduledTime || null,
    focusMinutes: Math.max(1, Number(focusMinutes) || 25),
    breakMinutes: Math.max(0, Number(breakMinutes) || 5),
    totalPomodoro: Math.max(1, Number(totalPomodoro) || 2),
    descriptionAsChecklist,
  });

  const requestSingleStudySessionDraft = async () => {
    setStudyDraftLoading(true);
    try {
      const response = await fetch("/api/ai/study-track-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSingleStudyDraftPayload()),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Could not generate study session");
      }

      const firstTrack = (data?.draft as StudyTrackDraftPreview | undefined)
        ?.tracks?.[0];
      if (!firstTrack) {
        throw new Error("AI did not return a study session suggestion");
      }

      setStudyDraft(data.draft);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate study session";
      toast.error(message);
    } finally {
      setStudyDraftLoading(false);
    }
  };

  const applySingleStudyDraft = () => {
    const firstTrack = studyDraft?.tracks?.[0];
    if (!firstTrack) return;

    applyStudyTrackToSingleSession(firstTrack);
    setStudyDraft(null);
    toast.success("AI study session applied");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const accepted = getAcceptedFiles(files);
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    const accepted = getAcceptedFiles(files);
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!title.trim()) {
      toast.error("Session title is required");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error("Pick a date and time for the session");
      return;
    }

    setCreating(true);
    const sessionScheduledAt = combineDateTime(scheduledDate, scheduledTime);

    const payload = {
      study_session_name: title.trim(),
      study_session_description: notes.trim() || undefined,
      focus_minutes: Math.max(1, Number(focusMinutes) || 25),
      break_minutes: Math.max(0, Number(breakMinutes) || 5),
      total_pomodoros: Math.max(1, Number(totalPomodoro) || 2),
      total_minutes: totalMinutesComputed,
      checklist_json: descriptionAsChecklist
        ? notes
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((text) => ({
            id: crypto.randomUUID(),
            text,
            completed: false,
          }))
        : null,
      study_session_scheduled_at: sessionScheduledAt.toISOString(),
      reminders: reminderEnabled ? reminderOffsetsInMinutes : [],
      reminder_enabled: reminderEnabled,
      task_id: selectedTask ? selectedTask.id : null,
      repeat_enabled: repeatEnabled && Boolean(selectedTask),
      repeat_every: repeatEnabled && selectedTask
        ? Math.max(1, Math.min(repeatUnit === "days" ? 30 : 12, Math.round(Number(repeatEvery) || 1)))
        : undefined,
      repeat_unit: repeatEnabled && selectedTask ? repeatUnit : undefined,
    };

    try {
      const response = await fetch("/api/study", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.message ?? "Failed to create study session");
        setCreating(false);
        return;
      }

      const fallbackId =
        data?.studySession?.study_session_id ?? data?.studySession?.id;
      const sessionIds: number[] =
        Array.isArray(data?.sessionIds) && data.sessionIds.length > 0
          ? data.sessionIds
          : fallbackId
            ? [fallbackId]
            : [];
      const failures: string[] = [];
      if (sessionIds.length > 0 && attachments.length > 0) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append("file", file);
          // Attach each file to every generated occurrence (matches batch).
          formData.append("studySessionIds", JSON.stringify(sessionIds));
          const uploadResponse = await fetch("/api/study/attachment", {
            method: "POST",
            body: formData,
          });
          if (!uploadResponse.ok) failures.push(file.name);
        }
      }

      if (failures.length > 0) {
        toast.warning(
          `Study session created. Some files failed: ${failures.join(", ")}`,
        );
      } else {
        toast.success(
          sessionIds.length > 1
            ? `Created ${sessionIds.length} study sessions`
            : "Study session created",
        );
      }
      router.push("/study");
    } catch {
      toast.error("Network error while creating study session");
      setCreating(false);
    }
  };

  if (taskId) {
    if (taskLoading) {
      return (
        <div className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground">Loading task...</p>
        </div>
      );
    }

    if (taskLoadError || !taskContext || !taskDeadline) {
      return (
        <div className="p-6 space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Task not available
          </h1>
          <p className="text-sm text-muted-foreground">
            {taskLoadError ?? "This task could not be loaded for study planning."}
          </p>
          <Button asChild variant="outline">
            <Link href="/tasks">Back to Tasks</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              PLAN STUDY SESSIONS
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
              BUILD A STUDY RHYTHM BEFORE THE DEADLINE
            </p>
          </div>
          <Button variant="outline" asChild className="font-mono text-xs">
            <Link href={`/tasks/${taskContext.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Task
            </Link>
          </Button>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="font-display text-lg">
                  {taskContext.title}
                </CardTitle>
                {taskContext.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {taskContext.description}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="w-fit font-mono text-[10px]">
                Due {format(taskDeadline, "MMM d, yyyy p")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    Study Sessions
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Add one session plan for each topic, pick the first date, set a cadence, and attach study materials.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={addTrack}>
                  <Plus className="h-4 w-4 mr-2" /> Add session
                </Button>
              </div>
            </div>

            {plannerError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {plannerError}
              </div>
            )}

            <div className="space-y-4">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground tracking-wider">
                      SESSION {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={tracks.length === 1}
                      onClick={() => removeTrack(track.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.4fr_180px]">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`track-topic-${track.id}`}
                        className="font-mono text-xs tracking-wider"
                      >
                        SESSION TOPIC
                      </Label>
                      <Input
                        id={`track-topic-${track.id}`}
                        placeholder="e.g. Mechanical Physics"
                        value={track.title}
                        onChange={(event) =>
                          updateTrack(track.id, { title: event.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`track-time-${track.id}`}
                        className="font-mono text-xs tracking-wider"
                      >
                        PREFERRED TIME
                      </Label>
                      <Input
                        id={`track-time-${track.id}`}
                        type="time"
                        value={track.time}
                        onChange={(event) =>
                          updateTrack(track.id, { time: event.target.value })
                        }
                        onClick={openNativePicker}
                        onFocus={openNativePicker}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`track-start-date-${track.id}`}
                        className="font-mono text-xs tracking-wider"
                      >
                        START DATE
                      </Label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Input
                          id={`track-start-date-${track.id}`}
                          type="date"
                          value={track.startDate}
                          onChange={(event) =>
                            updateTrack(track.id, {
                              startDate: event.target.value,
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateTrack(track.id, { startDate: localDateValue() })
                          }
                          className="shrink-0"
                        >
                          Today
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!taskDeadlineDateValue}
                          onClick={() =>
                            taskDeadlineDateValue &&
                            updateTrack(track.id, {
                              startDate: taskDeadlineDateValue,
                              repeatEnabled: false,
                            })
                          }
                          className="shrink-0"
                        >
                          On task day
                        </Button>
                      </div>
                    </div>

                    <RepeatControls
                      idPrefix={`track-${track.id}`}
                      checked={track.repeatEnabled}
                      every={track.repeatEvery}
                      unit={track.repeatUnit}
                      label="Repeat this track"
                      description="Repeats on this cadence until the task deadline."
                      onCheckedChange={(checked) =>
                        updateTrack(track.id, { repeatEnabled: checked })
                      }
                      onEveryChange={(value) =>
                        updateTrack(track.id, { repeatEvery: value })
                      }
                      onUnitChange={(unit, every) =>
                        updateTrack(track.id, { repeatUnit: unit, repeatEvery: every })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-xs tracking-wider">
                        FOCUS MINUTES
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={track.focusMinutes}
                        onChange={(event) =>
                          updateTrack(track.id, {
                            focusMinutes: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-mono text-xs tracking-wider">
                        BREAK MINUTES
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={track.breakMinutes}
                        onChange={(event) =>
                          updateTrack(track.id, {
                            breakMinutes: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-mono text-xs tracking-wider">
                        POMODOROS
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={track.totalPomodoro}
                        onChange={(event) =>
                          updateTrack(track.id, {
                            totalPomodoro: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`track-checklist-${track.id}`}
                        checked={track.descriptionAsChecklist}
                        onCheckedChange={(checked) =>
                          updateTrack(track.id, {
                            descriptionAsChecklist: checked === true,
                          })
                        }
                      />
                      <Label
                        htmlFor={`track-checklist-${track.id}`}
                        className="font-mono text-xs tracking-wider"
                      >
                        Make notes a checklist
                      </Label>
                    </div>
                    <Textarea
                      placeholder="Optional notes for this session..."
                      value={track.notes}
                      onChange={(event) =>
                        updateTrack(track.id, { notes: event.target.value })
                      }
                      className="resize-y min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono text-xs tracking-wider">
                      SESSION ATTACHMENTS
                    </Label>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {AI_READABLE_ATTACHMENT_HELPER_TEXT}
                    </p>
                    {track.attachments.length > 0 && (
                      <div className="space-y-2">
                        {track.attachments.map((file, fileIndex) => (
                          <div
                            key={`${file.name}-${fileIndex}`}
                            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                          >
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm flex-1 truncate">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTrackFile(track.id, fileIndex)}
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 px-4 py-5 cursor-pointer hover:border-accent/50 transition-colors"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (event.dataTransfer.files?.length) {
                          addTrackFiles(track.id, event.dataTransfer.files);
                        }
                      }}
                    >
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">
                        Drop session files here or click to browse
                      </span>
                      <input
                        aria-label="Session attachments"
                        type="file"
                        className="hidden"
                        multiple
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            addTrackFiles(track.id, event.target.files);
                          }
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="font-mono text-xs tracking-wider">
                    REMINDER
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apply the same reminder offsets to every generated session.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="study-reminder-enabled"
                    checked={reminderEnabled}
                    onCheckedChange={(checked) =>
                      setReminderEnabled(checked === true)
                    }
                  />
                  <Label
                    htmlFor="study-reminder-enabled"
                    className="font-mono text-xs tracking-wider"
                  >
                    Enable reminder
                  </Label>
                </div>
              </div>

              {reminderEnabled ? (
                <>
                  <div className="space-y-3">
                    {reminders.map((reminder, index) => {
                      const isAtStart = reminder.atStart === true;

                      return (
                        <div
                          key={`${reminder.unit}-${index}`}
                          className="grid gap-3 rounded-lg border border-border/50 bg-background/80 p-3 md:grid-cols-[1fr_180px_auto]"
                        >
                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs tracking-wider">
                              VALUE UNIT
                            </Label>
                            <Select
                              value={reminder.unit}
                              onValueChange={(v) =>
                                updateReminder(index, {
                                  unit: v as StudyReminderValueUnit,
                                })
                              }
                              disabled={!reminderEnabled}
                            >
                              <SelectTrigger className="font-mono text-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">
                                  Minutes before
                                </SelectItem>
                                <SelectItem value="hours">
                                  Hours before
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs tracking-wider">
                              VALUE
                            </Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isAtStart}
                                onCheckedChange={(checked) =>
                                  toggleStartReminder(index, checked === true)
                                }
                                disabled={!reminderEnabled}
                              />
                              <Label className="font-mono text-xs tracking-wider">
                                At Start
                              </Label>
                            </div>
                            {isAtStart ? (
                              <div className="flex h-10 items-center rounded-md border border-dashed border-border/60 bg-muted/30 px-3 text-sm text-muted-foreground">
                                At Start
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min={1}
                                value={reminder.value}
                                onChange={(event) =>
                                  updateReminder(index, {
                                    value: Number(event.target.value),
                                  })
                                }
                                disabled={!reminderEnabled}
                              />
                            )}
                          </div>

                          <div className="flex items-end justify-between gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeReminder(index)}
                              disabled={!reminderEnabled}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Default reminders are 15 minutes, 5 minutes, and an At
                      Start reminder.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addReminder}
                      disabled={!reminderEnabled}
                    >
                      Add reminder
                    </Button>
                  </div>
                </>
              ) : null}
            </div>

            <AiSuggestionsButton
              description="Suggest a study plan from this task's deadline and topics."
              loading={studyDraftLoading}
              onClick={requestStudyTrackDraft}
            />

            {studyDraft && (
              <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                <div>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground">
                    AI STUDY PLAN
                  </p>
                  {studyDraft.reasoning ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {studyDraft.reasoning}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {studyDraft.tracks.map((track, index) => (
                    <div
                      key={`${track.title}-${index}`}
                      className="rounded-md border border-border/60 bg-background/60 p-3"
                    >
                      <p className="text-sm font-semibold">{track.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {track.start_date} at {track.time} · {track.focus_minutes}m x{" "}
                        {track.total_pomodoros}
                      </p>
                      {track.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {track.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {studyDraft.warnings?.length ? (
                  <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                    {studyDraft.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-muted-foreground">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
                {studyDraft.skippedAttachments?.length ? (
                  <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
                      SKIPPED FILES
                    </p>
                    {studyDraft.skippedAttachments.map((attachment) => (
                      <p
                        key={`${attachment.fileName}-${attachment.reason}`}
                        className="text-xs text-muted-foreground"
                      >
                        {attachment.fileName}: {attachment.reason}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={applyStudyTrackDraft}>
                    Apply study plan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStudyDraft(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                disabled={savingBatch}
                onClick={saveGeneratedSessions}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {savingBatch ? "Creating..." : "Create Sessions"}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/tasks/${taskContext.id}`}>Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            NEW STUDY SESSION
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            PLAN YOUR NEXT FOCUS BLOCK
          </p>
        </div>
        <Button variant="outline" asChild className="font-mono text-xs">
          <Link href="/study">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Study
          </Link>
        </Button>
      </div>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSession} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">TITLE</Label>
              <Input
                placeholder="e.g. Biology chapter 6 review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex min-w-full gap-4 md:flex-row flex-col">
              <div className="space-y-1.5 flex-1">
                <Label className="font-mono text-xs tracking-wider">
                  SCHEDULE DATE
                </Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate
                        ? format(scheduledDate, "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={(value) => {
                        setScheduledDate(value);
                        setCalOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5 flex-1">
                <Label className="font-mono text-xs tracking-wider">TIME</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  onClick={openNativePicker}
                  onFocus={openNativePicker}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                LINKED TASK
              </Label>
              <Popover open={taskPickerOpen} onOpenChange={setTaskPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={taskPickerOpen}
                    className="w-full justify-between font-mono text-sm"
                  >
                    <span className="truncate">
                      {selectedTask ? selectedTask.title : "No task"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tasks..." />
                    <CommandList>
                      <CommandEmpty>No matching task.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="No task"
                          onSelect={() => handleStandaloneTaskSelect("none")}
                          onClick={() => handleStandaloneTaskSelect("none")}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              selectedTaskId === "none" ? "opacity-100" : "opacity-0",
                            )}
                          />
                          No task
                        </CommandItem>
                        {taskOptions.map((task) => (
                          <CommandItem
                            key={task.id}
                            value={task.title}
                            onSelect={() => handleStandaloneTaskSelect(String(task.id))}
                            onClick={() => handleStandaloneTaskSelect(String(task.id))}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedTaskId === String(task.id)
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="flex-1 truncate">{task.title}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {format(new Date(task.deadline), "MMM d")}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="font-mono text-[10px] text-muted-foreground">
                Link this session to an existing task to unlock repeat.
              </p>
            </div>

            {/* Repeat only applies to task-linked sessions, so hide it entirely
                until a task is chosen to keep the form uncluttered. */}
            {selectedTask && (
              <RepeatControls
                idPrefix="study"
                checked={repeatEnabled}
                every={repeatEvery}
                unit={repeatUnit}
                label="Enable repeat"
                description="Repeats on this cadence until the linked task's deadline."
                onCheckedChange={setRepeatEnabled}
                onEveryChange={setRepeatEvery}
                onUnitChange={(unit, every) => {
                  setRepeatUnit(unit);
                  setRepeatEvery(every);
                }}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="focusMinutes" className="font-mono text-xs tracking-wider">
                  FOCUS MINUTES
                </Label>
                <Input
                  id="focusMinutes"
                  type="number"
                  min={1}
                  value={focusMinutes}
                  onChange={(e) => setFocusMinutes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  BREAK MINUTES
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground md:col-span-2">
                Defaults are 25 minutes focus and 5 minutes break.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs tracking-wider">
                POMODOROS
              </Label>
              <Input
                type="number"
                min={1}
                value={totalPomodoro}
                onChange={(e) => setTotalPomodoro(Number(e.target.value))}
              />
              <p className="font-mono text-[10px] text-muted-foreground">
                Total minutes: {totalMinutesComputed}m
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">NOTES</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="description-as-checklist"
                  checked={descriptionAsChecklist}
                  onCheckedChange={(checked) =>
                    setDescriptionAsChecklist(checked === true)
                  }
                />
                <Label
                  htmlFor="description-as-checklist"
                  className="font-mono text-xs tracking-wider"
                >
                  Make the description a checklist
                </Label>
              </div>
              <Textarea
                placeholder={
                  descriptionAsChecklist
                    ? "Make a checklist by separating each checklist item with a newline, e.g.\n\nRead chapter 3\nSolve 10 questions\nReview mistakes"
                    : "Add notes for this study session..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-y min-h-22.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                ATTACHMENTS
              </Label>
              <p className="font-mono text-[10px] text-muted-foreground">
                {AI_READABLE_ATTACHMENT_HELPER_TEXT}
              </p>
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 px-4 py-6 cursor-pointer hover:border-accent/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Paperclip className="h-6 w-6 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  Drop files here or click to browse
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="font-mono text-xs tracking-wider">
                    REMINDER
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure how long before the session you want to be
                    reminded.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="study-reminder-enabled"
                    checked={reminderEnabled}
                    onCheckedChange={(checked) =>
                      setReminderEnabled(checked === true)
                    }
                  />
                  <Label
                    htmlFor="study-reminder-enabled"
                    className="font-mono text-xs tracking-wider"
                  >
                    Enable reminder
                  </Label>
                </div>
              </div>

              {reminderEnabled ? (
                <>
                  <div className="space-y-3">
                    {reminders.map((reminder, index) => {
                      const isAtStart = reminder.atStart === true;

                      return (
                        <div
                          key={`${reminder.unit}-${index}`}
                          className="grid gap-3 rounded-lg border border-border/50 bg-background/80 p-3 md:grid-cols-[1fr_180px_auto]"
                        >
                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs tracking-wider">
                              VALUE UNIT
                            </Label>
                            <Select
                              value={reminder.unit}
                              onValueChange={(v) =>
                                updateReminder(index, {
                                  unit: v as StudyReminderValueUnit,
                                })
                              }
                              disabled={!reminderEnabled}
                            >
                              <SelectTrigger className="font-mono text-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">
                                  Minutes before
                                </SelectItem>
                                <SelectItem value="hours">
                                  Hours before
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs tracking-wider">
                              VALUE
                            </Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isAtStart}
                                onCheckedChange={(checked) =>
                                  toggleStartReminder(index, checked === true)
                                }
                                disabled={!reminderEnabled}
                              />
                              <Label className="font-mono text-xs tracking-wider">
                                At Start
                              </Label>
                            </div>
                            {isAtStart ? (
                              <div className="flex h-10 items-center rounded-md border border-dashed border-border/60 bg-muted/30 px-3 text-sm text-muted-foreground">
                                At Start
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min={1}
                                value={reminder.value}
                                onChange={(e) =>
                                  updateReminder(index, {
                                    value: Number(e.target.value),
                                  })
                                }
                                disabled={!reminderEnabled}
                              />
                            )}
                          </div>

                          <div className="flex items-end justify-between gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeReminder(index)}
                              disabled={!reminderEnabled}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Default reminders are 15 minutes, 5 minutes, and an At
                      Start reminder.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addReminder}
                      disabled={!reminderEnabled}
                    >
                      Add reminder
                    </Button>
                  </div>
                </>
              ) : null}
            </div>

            <AiSuggestionsButton
              description="Generate one study session from this form and optional linked task."
              loading={studyDraftLoading}
              onClick={requestSingleStudySessionDraft}
            />

            {studyDraft ? (
              <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                <div>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground">
                    AI STUDY SESSION
                  </p>
                  {studyDraft.reasoning ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {studyDraft.reasoning}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {studyDraft.tracks.map((track, index) => (
                    <div
                      key={`${track.title}-${index}`}
                      className="rounded-md border border-border/60 bg-background/60 p-3"
                    >
                      <p className="text-sm font-semibold">{track.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {track.start_date} at {track.time} - {track.focus_minutes}m x{" "}
                        {track.total_pomodoros}
                      </p>
                      {track.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {track.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                {studyDraft.warnings?.length ? (
                  <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                    {studyDraft.warnings.map((warning) => (
                      <p key={warning} className="text-xs text-muted-foreground">
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
                {studyDraft.skippedAttachments?.length ? (
                  <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
                      SKIPPED FILES
                    </p>
                    {studyDraft.skippedAttachments.map((attachment) => (
                      <p
                        key={`${attachment.fileName}-${attachment.reason}`}
                        className="text-xs text-muted-foreground"
                      >
                        {attachment.fileName}: {attachment.reason}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={applySingleStudyDraft}>
                    Apply study session
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStudyDraft(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={creating}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {creating ? "Creating..." : "Create Session"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/study">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
