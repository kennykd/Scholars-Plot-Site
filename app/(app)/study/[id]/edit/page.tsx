"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn, openNativePicker } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Clock, Paperclip, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import type {
  Attachment,
  StudyReminderOffset,
  StudyReminderValueUnit,
  Task,
} from "@/types";
import { AiSuggestionsButton } from "@/app/components/common/ai-suggestions-button";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ApiStudyAttachmentLink = {
  attachment?: {
    attachment_id: number;
    task_id?: number | null;
    user_id?: string | null;
    file_name: string;
    file_path: string;
    file_type: string;
    url?: string | null;
    attachment_uploaded_at?: string | Date | null;
  } | null;
};

const isApiAttachment = (
  attachment: ApiStudyAttachmentLink["attachment"],
): attachment is NonNullable<ApiStudyAttachmentLink["attachment"]> =>
  Boolean(attachment);

type StudyTrackDraft = {
  title: string;
  start_date: string;
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

export default function StudyEditPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const sessionId = Array.isArray(routeParams.id)
    ? routeParams.id[0]
    : routeParams.id;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalPomodoro, setTotalPomodoro] = useState(2);
  const [descriptionAsChecklist, setDescriptionAsChecklist] = useState(true);
  const [calOpen, setCalOpen] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [studyDraft, setStudyDraft] = useState<StudyTrackDraftPreview | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("none");
  const [taskOptions, setTaskOptions] = useState<Task[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminders, setReminders] = useState<StudyReminderOffset[]>([
    { unit: "minutes", value: 15 },
    { unit: "minutes", value: 5 },
    { unit: "minutes", value: 0, atStart: true },
  ]);

  useEffect(() => {
    if (!sessionId) {
      toast.error("Missing study session id");
      router.push("/study");
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/study/${sessionId}`);
        const data = await response.json();

        if (!response.ok) {
          toast.error(data?.message ?? "Failed to load study session");
          router.push("/study");
          return;
        }

        const apiStudy = data?.studySession;
        if (!apiStudy) {
          toast.error("Study session not found");
          router.push("/study");
          return;
        }

        const scheduledAt = apiStudy.study_session_scheduled_at
          ? parseISO(apiStudy.study_session_scheduled_at)
          : undefined;
        const checklistItems = Array.isArray(apiStudy.checklist_json)
          ? apiStudy.checklist_json
          : [];

        const nextNotes =
          checklistItems.length > 0
            ? checklistItems
              .map((item: { text?: string }) => item.text ?? "")
              .filter(Boolean)
              .join("\n")
            : (apiStudy.study_session_description ?? "");

        const persistedAttachments = Array.isArray(apiStudy.study_session_attachments)
          ? (apiStudy.study_session_attachments as ApiStudyAttachmentLink[])
              .map((link) => link?.attachment)
              .filter(isApiAttachment)
              .map((attachment) => ({
                id: attachment.attachment_id,
                taskId: attachment.task_id ?? null,
                userId: attachment.user_id ?? null,
                fileName: attachment.file_name,
                fileKey: attachment.file_path,
                fileType: attachment.file_type,
                url: attachment.url ?? "",
                uploadedAt: attachment.attachment_uploaded_at
                  ? new Date(attachment.attachment_uploaded_at).toISOString()
                  : new Date().toISOString(),
              }))
          : [];

        setTitle(apiStudy.study_session_name ?? "");
        setNotes(nextNotes);
        setExistingAttachments(persistedAttachments);
        setScheduledDate(scheduledAt);
        setScheduledTime(scheduledAt ? format(scheduledAt, "HH:mm") : "");
        setFocusMinutes(apiStudy.focus_minutes ?? 25);
        setBreakMinutes(apiStudy.break_minutes ?? 5);
        setTotalPomodoro(apiStudy.total_pomodoros ?? 2);
        setDescriptionAsChecklist(checklistItems.length > 0);

        const currentTaskId = apiStudy.study_session_user?.[0]?.task_id;
        setSelectedTaskId(currentTaskId ? String(currentTaskId) : "none");

        // Prefill reminders so editing keeps the session's existing offsets.
        setReminderEnabled(Boolean(apiStudy.study_session_reminder_enabled));
        const reminderMinutes = Array.isArray(
          apiStudy.study_session_remind_at_minutes,
        )
          ? (apiStudy.study_session_remind_at_minutes as number[])
          : [];
        if (reminderMinutes.length > 0) {
          setReminders(
            reminderMinutes.map((minute) =>
              minute <= 0
                ? { unit: "minutes", value: 0, atStart: true }
                : { unit: "minutes", value: minute },
            ),
          );
        }
      } catch {
        toast.error("Network error while loading study session");
        router.push("/study");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router, sessionId]);

  // Load the user's tasks so the session can be linked, relinked, or unlinked.
  useEffect(() => {
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
  }, []);

  const totalMinutesComputed =
    (Math.max(1, Number(focusMinutes) || 0) +
      Math.max(1, Number(breakMinutes) || 0)) *
    Math.max(1, Number(totalPomodoro) || 0);

  const reminderOffsetsInMinutes = reminders
    .filter(() => reminderEnabled)
    .map((reminder) => {
      if (reminder.atStart) return 0;
      const value = Math.max(1, Number(reminder.value) || 1);
      return reminder.unit === "hours" ? value * 60 : value;
    });

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
        if (checked) return { ...reminder, atStart: true, value: 0 };
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const accepted = getAcceptedFiles(files);
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    const accepted = getAcceptedFiles(files);
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const removeExistingAttachment = async (attachmentId: number) => {
    const response = await fetch(
      `/api/study/${sessionId}/attachment/${attachmentId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      toast.error("Failed to remove attachment");
      return;
    }

    setExistingAttachments((prev) =>
      prev.filter((attachment) => attachment.id !== attachmentId),
    );
    toast.success("Attachment removed");
  };

  const applyStudyTrackToSession = (track: StudyTrackDraft) => {
    setTitle(track.title);
    setNotes(track.notes);
    setScheduledTime(track.time);
    setFocusMinutes(track.focus_minutes);
    setBreakMinutes(track.break_minutes);
    setTotalPomodoro(track.total_pomodoros);
    setDescriptionAsChecklist(track.description_as_checklist);

    const draftDate = parseStudyTrackDate(track.start_date);
    if (draftDate) setScheduledDate(draftDate);
  };

  const buildStudyDraftPayload = () => {
    const taskId = Number(selectedTaskId);

    return {
      ...(selectedTaskId !== "none" && Number.isInteger(taskId) && taskId > 0
        ? { taskId }
        : {}),
      title: title.trim(),
      notes: notes.trim(),
      scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
      scheduledTime: scheduledTime || null,
      focusMinutes: Math.max(1, Number(focusMinutes) || 25),
      breakMinutes: Math.max(0, Number(breakMinutes) || 5),
      totalPomodoro: Math.max(1, Number(totalPomodoro) || 2),
      descriptionAsChecklist,
    };
  };

  const requestSingleStudySessionDraft = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/study-track-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStudyDraftPayload()),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Could not generate study session");
      }

      const draft = data?.draft as StudyTrackDraftPreview | undefined;
      const firstTrack = draft?.tracks?.[0];
      if (!firstTrack) {
        throw new Error("AI did not return a study session suggestion");
      }

      setStudyDraft(draft);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate study session";
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

  const applySingleStudyDraft = () => {
    const firstTrack = studyDraft?.tracks?.[0];
    if (!firstTrack) return;

    applyStudyTrackToSession(firstTrack);
    setStudyDraft(null);
    toast.success("AI study session applied");
  };

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Session title is required");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error("Pick a date and time for the session");
      return;
    }

    const payload = {
      study_session_name: title.trim(),
      study_session_description: notes.trim() || undefined,
      focus_minutes: Math.max(1, Number(focusMinutes) || 25),
      break_minutes: Math.max(0, Number(breakMinutes) || 5),
      total_pomodoros: Math.max(1, Number(totalPomodoro) || 2),
      total_minutes: totalMinutesComputed,
      // First it checks if the user wants the description to be written as a checklist, if not then the checklist will be null
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
      study_session_scheduled_at: combineDateTime(
        scheduledDate,
        scheduledTime,
      ).toISOString(),
      // Link/relink to the chosen task, or unlink with null ("none").
      task_id: selectedTaskId !== "none" ? Number(selectedTaskId) : null,
      reminder_enabled: reminderEnabled,
      reminders: reminderEnabled ? reminderOffsetsInMinutes : [],
    };

    try {
      const response = await fetch(`/api/study/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.message ?? "Failed to update study session");
        return;
      }

      const failures: string[] = [];
      if (attachments.length > 0) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("studySessionIds", JSON.stringify([Number(sessionId)]));

          const uploadResponse = await fetch("/api/study/attachment", {
            method: "POST",
            body: formData,
          });
          if (!uploadResponse.ok) failures.push(file.name);
        }
      }

      if (failures.length > 0) {
        toast.warning(
          `Study session updated. Some files failed: ${failures.join(", ")}`,
        );
      } else {
        toast.success("Study session updated");
      }
      router.push("/study");
    } catch {
      toast.error("Network error while updating study session");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              EDIT STUDY SESSION
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
              LOADING CURRENT SESSION DATA
            </p>
          </div>
          <Button variant="outline" asChild className="font-mono text-xs">
            <Link href="/study">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Study
            </Link>
          </Button>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-10 text-center text-muted-foreground">
            Loading session...
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
            EDIT STUDY SESSION
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            UPDATE YOUR CURRENT FOCUS BLOCK
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
          <form onSubmit={handleEditSession} className="space-y-5 pt-2">
            {/* Insert Title */}
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">TITLE</Label>
              <Input
                placeholder="e.g. Biology chapter 6 review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Insert Date and Time (using calendar popup for date) */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  SCHEDULE DATE
                </Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {/* Displays the value of the date with format "PPP" (e.g. April 1st, 2026) */}
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

              {/* Setting the time */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="scheduled-time"
                  className="font-mono text-xs tracking-wider"
                >
                  TIME
                </Label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    onClick={openNativePicker}
                    onFocus={openNativePicker}
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                </div>
              </div>
            </div>

            {/* Link the session to a task (or leave it standalone) */}
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                LINKED TASK
              </Label>
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger className="w-full font-mono text-sm">
                  <SelectValue placeholder="No task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="font-mono text-[10px] text-muted-foreground">
                Connect this session to a task, or leave it standalone.
              </p>
            </div>

            {/* Insert Focus Minutes and Break Minutes (For Pomodoro) */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  FOCUS MINUTES
                </Label>
                <Input
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
                  min={0}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Defaults are 25 minutes focus and 5 minutes break.
              </p>
            </div>

            {/* Insert total duration of study session */}
            <div className="space-y-2">
              <Label className="font-mono text-xs tracking-wider">
                How many Pomodoro sessions?
              </Label>
              <Input
                type="number"
                min={1}
                value={totalPomodoro}
                onChange={(e) => setTotalPomodoro(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Total Minutes: {totalMinutesComputed}m
              </p>
            </div>

            {/* Insert Notes (If the study session is derived from task/project, AI will fill this with a checklist of what to do) */}
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

            {/* Insert Attachments */}
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                ATTACHMENTS
              </Label>
              <p className="font-mono text-[10px] text-muted-foreground">
                {AI_READABLE_ATTACHMENT_HELPER_TEXT}
              </p>
              {existingAttachments.length > 0 || attachments.length > 0 ? (
                <div className="space-y-2">
                  {existingAttachments.map((file) => (
                    <div
                      key={`existing-${file.id}-${file.fileKey}`}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm flex-1 truncate hover:text-accent"
                      >
                        {file.fileName}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeExistingAttachment(file.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                  {attachments.map((file, index) => (
                    <div
                      key={`new-${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
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
              loading={aiLoading}
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
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                Update Session
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
