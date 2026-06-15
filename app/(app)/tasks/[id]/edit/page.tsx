"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { StarRating } from "@/app/components/common/star-rating";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Clock,
  Paperclip,
  X,
} from "lucide-react";
import { cn, openNativePicker } from "@/lib/utils";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";
import { AiSuggestionsButton } from "@/app/components/common/ai-suggestions-button";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type SessionOption = { id: number; title: string; scheduledAt: string };

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
};

export default function TaskEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(2.5);
  const [files, setFiles] = useState<File[]>([]);
  const [calOpen, setCalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [initialSessionIds, setInitialSessionIds] = useState<number[]>([]);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<TaskDraftPreview | null>(null);
  

  const toggleSession = (id: number) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`);
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (!active) return;
        const task = data.task;
        const dl = new Date(task.deadline);
        setTitle(task.title ?? "");
        setDescription(task.description ?? "");
        setPriority(Number(task.priority) || 2.5);
        setDeadline(dl);
        setDeadlineTime(format(dl, "HH:mm"));
        const linkedIds: number[] = Array.isArray(data.linkedStudySessionIds)
          ? data.linkedStudySessionIds
          : [];
        setSelectedSessionIds(linkedIds);
        setInitialSessionIds(linkedIds);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [taskId]);

  // Load the user's study sessions so existing ones can be linked to this task.
  useEffect(() => {
    let active = true;
    fetch("/api/study")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message ?? "Could not load sessions");
        return (
          (data?.studySessions as Array<{
            id: string;
            title: string;
            scheduledAt: string;
          }>) ?? []
        );
      })
      .then((sessions) => {
        if (!active) return;
        setSessionOptions(
          sessions.map((s) => ({
            id: Number(s.id),
            title: s.title,
            scheduledAt: s.scheduledAt,
          })),
        );
      })
      .catch(() => {
        // Linking sessions is optional, so a failed fetch is non-fatal.
      });
    return () => {
      active = false;
    };
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" exceeds 10MB and was skipped`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setAiPreview(null);
      setFiles((prev) => [...prev, ...accepted]);
    }
  };

  const getCombinedDeadline = () => {
    if (!deadline) return null;
    const [hh, mm] = (deadlineTime || "23:59").split(":").map(Number);
    const combined = new Date(deadline);
    combined.setHours(hh, mm, 0, 0);
    return combined;
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
    toast.success("AI suggestions applied");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Task name is required");
    const combined = getCombinedDeadline();
    if (!combined) return toast.error("Deadline is required");

    setSubmitting(true);
    try {
      const res = await fetch(`/api/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          deadline: combined.toISOString(),
          priority,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const firstError =
          body?.errors && typeof body.errors === "object"
            ? Object.values(body.errors).flat()[0]
            : null;
        throw new Error(firstError ?? body?.message ?? "Failed to update task");
      }

      // Link/unlink existing study sessions by updating each session's task_id.
      const toLink = selectedSessionIds.filter(
        (id) => !initialSessionIds.includes(id),
      );
      const toUnlink = initialSessionIds.filter(
        (id) => !selectedSessionIds.includes(id),
      );
      const linkResponses = await Promise.all([
        ...toLink.map((sid) =>
          fetch(`/api/study/${sid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: taskId }),
          }),
        ),
        ...toUnlink.map((sid) =>
          fetch(`/api/study/${sid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: null }),
          }),
        ),
      ]);
      const sessionLinkFailed = linkResponses.some((r) => !r.ok);

      const failures: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch(`/api/task/${taskId}/attachment`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) failures.push(f.name);
      }
      if (failures.length > 0) {
        toast.warning(`Task saved. Some files failed: ${failures.join(", ")}`);
      } else if (sessionLinkFailed) {
        toast.warning("Task saved, but some study session links did not update");
      } else {
        toast.success("Task updated");
      }

      router.push(`/tasks/${taskId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update task");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading task...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Task not found
        </h1>
        <Button asChild variant="outline">
          <Link href="/tasks">Back to Tasks</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            EDIT TASK
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            UPDATE YOUR TASK DETAILS
          </p>
        </div>
        <Button variant="outline" asChild className="font-mono text-xs">
          <Link href={`/tasks/${taskId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Task
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
              <Label htmlFor="title" className="font-mono text-xs tracking-wider">
                TASK NAME *
              </Label>
              <Input
                id="title"
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
                    className="pl-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="font-mono text-xs tracking-wider">
                DESCRIPTION
              </Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-y min-h-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">PRIORITY</Label>
              <div className="flex items-center gap-3">
                <StarRating value={priority} onChange={setPriority} size="lg" />
                <span className="font-mono text-sm text-muted-foreground">
                  {priority.toFixed(1)} / 5.0
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                LINKED STUDY SESSIONS
              </Label>
              <Popover
                open={sessionPickerOpen}
                onOpenChange={setSessionPickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={sessionPickerOpen}
                    className="w-full justify-between font-mono text-sm"
                  >
                    <span className="truncate">
                      {selectedSessionIds.length === 0
                        ? "No study sessions linked"
                        : `${selectedSessionIds.length} session${selectedSessionIds.length > 1 ? "s" : ""} linked`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search study sessions..." />
                    <CommandList>
                      <CommandEmpty>No study sessions found.</CommandEmpty>
                      <CommandGroup>
                        {sessionOptions.map((s) => {
                          const checked = selectedSessionIds.includes(s.id);
                          return (
                            <CommandItem
                              key={s.id}
                              value={`${s.title} ${s.id}`}
                              onSelect={() => toggleSession(s.id)}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  checked ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="flex-1 truncate">{s.title}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {format(new Date(s.scheduledAt), "MMM d")}
                              </span>
                            </CommandItem>
                          );
                        })}
                        
                      </CommandGroup>
                    </CommandList>
                    
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="font-mono text-[10px] text-muted-foreground">
                Link existing study sessions to this task. Changes save with the
                task.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">
                ADD ATTACHMENTS
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
                      <button
                        type="button"
                        onClick={() => {
                          setAiPreview(null);
                          setFiles((prev) => prev.filter((_, j) => j !== i));
                        }}
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
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
              >
                <Paperclip className="h-6 w-6 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  Drop files here or click to browse (10MB max each)
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="font-mono text-[10px] text-muted-foreground">
                Existing attachments are managed on the task page.
              </p>
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
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/tasks/${taskId}`}>Cancel</Link>
              </Button>
              
            </div>
          </form>
          
        </CardContent>
      </Card>
    </div>
  );
}
