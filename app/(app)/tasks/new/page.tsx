"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StarRating } from "@/app/components/common/star-rating";
import { StudySessionPrompt } from "@/app/components/tasks/study-session-prompt";
import { AiSuggestionsButton } from "@/app/components/common/ai-suggestions-button";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Clock, Paperclip, X } from "lucide-react";
import { cn, openNativePicker } from "@/lib/utils";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type TaskDraftPreview = {
  draft: {
    title: string;
    description: string;
    priority: number;
    reasoning?: string;
    skippedAttachments?: {
      fileName: string;
      fileType: string;
      reason: string;
    }[];
  };
  attachmentIds: number[];
};

export default function TaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(2.5);
  const [files, setFiles] = useState<File[]>([]);
  const [calOpen, setCalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTask, setCreatedTask] = useState<{ id: number; title: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<TaskDraftPreview | null>(null);
  const [draftAttachmentIds, setDraftAttachmentIds] = useState<number[]>([]);

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" exceeds 10MB and was skipped`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setAiPreview(null);
      setDraftAttachmentIds([]);
      setFiles((prev) => [...prev, ...accepted]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setAiPreview(null);
    setDraftAttachmentIds([]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const getCombinedDeadline = () => {
    if (!deadline) return null;
    const [hh, mm] = (deadlineTime || "23:59").split(":").map(Number);
    const combinedDeadline = new Date(deadline);
    combinedDeadline.setHours(hh, mm, 0, 0);
    return combinedDeadline;
  };

  const requestTaskDraft = async () => {
    if (!title.trim() && !description.trim() && files.length === 0) {
      toast.error("Add a title, description, or attachment before asking AI");
      return;
    }

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("priority", String(priority));

      const combinedDeadline = getCombinedDeadline();
      if (combinedDeadline) {
        formData.set("deadline", combinedDeadline.toISOString());
      }

      for (const file of files) {
        formData.append("file", file);
      }

      const response = await fetch("/api/ai/task-draft", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Could not generate AI suggestions");
      }

      setAiPreview({
        draft: data.draft,
        attachmentIds: data.attachmentIds ?? [],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not generate AI suggestions",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const applyTaskDraft = () => {
    if (!aiPreview) return;
    setTitle(aiPreview.draft.title);
    setDescription(aiPreview.draft.description);
    setPriority(aiPreview.draft.priority);
    setDraftAttachmentIds(aiPreview.attachmentIds);
    toast.success("AI suggestions applied");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task name is required");
      return;
    }
    if (!deadline) {
      toast.error("Deadline is required");
      return;
    }

    setSubmitting(true);
    try {
      const combinedDeadline = getCombinedDeadline();
      if (!combinedDeadline) {
        toast.error("Deadline is required");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          deadline: combinedDeadline.toISOString(),
          status: "Pending",
          priority,
          ...(draftAttachmentIds.length > 0 ? { attachmentIds: draftAttachmentIds } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const firstError =
          body?.errors && typeof body.errors === "object"
            ? Object.values(body.errors).flat()[0]
            : null;
        throw new Error(firstError ?? body?.message ?? "Failed to create task");
      }

      const created = await res.json();
      const taskId: number | undefined = created?.task?.id;

      if (taskId && files.length > 0 && draftAttachmentIds.length === 0) {
        const failures: string[] = [];
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f);
          const uploadRes = await fetch(`/api/task/${taskId}/attachment`, {
            method: "POST",
            body: fd,
          });
          if (!uploadRes.ok) failures.push(f.name);
        }
        if (failures.length > 0) {
          toast.warning(
            `Task created. Some files failed: ${failures.join(", ")}`,
          );
        } else {
          toast.success("Task created");
        }
      } else {
        toast.success("Task created");
      }

      if (taskId) {
        setCreatedTask({ id: taskId, title: title.trim() });
        setSubmitting(false);
      } else {
        router.push("/tasks");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create task");
      setSubmitting(false);
    }
  };

  const finishWithoutPlanning = () => {
    router.push("/tasks");
    router.refresh();
  };

  const openStudyPlanner = () => {
    if (!createdTask) return;
    router.push(`/study/new?taskId=${createdTask.id}`);
    router.refresh();
  };

  return (
    <div className="p-6 space-y-6">
      {createdTask && (
        <StudySessionPrompt
          taskName={createdTask.title}
          onPlan={openStudyPlanner}
          onSkip={finishWithoutPlanning}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            NEW TASK
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            CREATE A NEW TASK
          </p>
        </div>
        <Button variant="outline" asChild className="font-mono text-xs">
          <Link href="/tasks">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tasks
          </Link>
        </Button>
      </div>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="title"
                className="font-mono text-xs tracking-wider"
              >
                TASK NAME *
              </Label>
              <Input
                id="title"
                placeholder="e.g. Calculus II Problem Set 6"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  DEADLINE DATE *
                </Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deadline && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={(d) => {
                        setDeadline(d);
                        setCalOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="deadline-time"
                  className="font-mono text-xs tracking-wider"
                >
                  DEADLINE TIME
                </Label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="deadline-time"
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    onClick={openNativePicker}
                    onFocus={openNativePicker}
                    placeholder="23:59"
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Defaults to 23:59 if left blank.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="desc"
                className="font-mono text-xs tracking-wider"
              >
                DESCRIPTION
              </Label>
              <Textarea
                id="desc"
                placeholder="Optional task description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-y min-h-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                ATTACHMENTS
              </Label>
              <p className="font-mono text-[10px] text-muted-foreground">
                {AI_READABLE_ATTACHMENT_HELPER_TEXT}
              </p>
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 px-4 py-6 cursor-pointer hover:border-accent/50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Paperclip className="h-6 w-6 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  Drop files here or click to browse (10MB max each)
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                PRIORITY
              </Label>
              <div className="flex items-center gap-3">
                <StarRating value={priority} onChange={setPriority} size="lg" />
                <span className="font-mono text-sm text-muted-foreground">
                  {priority.toFixed(1)} / 5.0
                </span>
              </div>
            </div>

            <AiSuggestionsButton
              description="Get task ideas based on your title, description, and files."
              loading={aiLoading}
              onClick={requestTaskDraft}
            />

            {aiPreview && (
              <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                <div>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground">
                    AI DRAFT
                  </p>
                  <h2 className="mt-1 text-base font-semibold">
                    {aiPreview.draft.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                    {aiPreview.draft.description}
                  </p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  Priority: {Number(aiPreview.draft.priority).toFixed(1)} / 5.0
                </p>
                {aiPreview.draft.reasoning ? (
                  <p className="text-sm text-muted-foreground">
                    {aiPreview.draft.reasoning}
                  </p>
                ) : null}
                {aiPreview.draft.skippedAttachments?.length ? (
                  <div className="space-y-1 rounded-md border border-border/60 bg-background/60 p-3">
                    <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
                      SKIPPED FILES
                    </p>
                    {aiPreview.draft.skippedAttachments.map((attachment) => (
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
                  <Button type="button" size="sm" onClick={applyTaskDraft}>
                    Apply suggestions
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAiPreview(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {submitting ? "Creating..." : "Create Task"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/tasks">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
