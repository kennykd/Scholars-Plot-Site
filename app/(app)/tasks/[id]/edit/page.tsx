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
import { StarRating } from "@/app/components/common/star-rating";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Paperclip, X } from "lucide-react";
import { cn, openNativePicker } from "@/lib/utils";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`);
        if (!res.ok) throw new Error("not found");
        const { task } = await res.json();
        if (!active) return;
        const dl = new Date(task.deadline);
        setTitle(task.title ?? "");
        setDescription(task.description ?? "");
        setPriority(Number(task.priority) || 2.5);
        setDeadline(dl);
        setDeadlineTime(format(dl, "HH:mm"));
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

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" exceeds 10MB and was skipped`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  };

  const getCombinedDeadline = () => {
    if (!deadline) return null;
    const [hh, mm] = (deadlineTime || "23:59").split(":").map(Number);
    const combined = new Date(deadline);
    combined.setHours(hh, mm, 0, 0);
    return combined;
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
                      initialFocus
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
                <Input
                  id="deadline-time"
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  onClick={openNativePicker}
                  onFocus={openNativePicker}
                />
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
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
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
