"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Paperclip, X, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { StudyReminderOffset, StudyReminderValueUnit } from "@/types";

const combineDateTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours);
  next.setMinutes(minutes);
  next.setSeconds(0, 0);
  return next;
};

const valueToMs = (valueUnit: StudyReminderValueUnit, value: number) => {
  const normalizedValue = Math.max(1, value);

  switch (valueUnit) {
    case "minutes":
      return normalizedValue * 60 * 1000;
    case "hours":
      return normalizedValue * 60 * 60 * 1000;
  }
};

export default function StudyNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Get the taskId if the user is coming from a task
  const taskId = searchParams.get("taskId")

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalPomodoro, setTotalPomodoro] = useState(2);
  const [descriptionAsChecklist, setDescriptionAsChecklist] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminders, setReminders] = useState<StudyReminderOffset[]>([
    { unit: "minutes", value: 15 },
    { unit: "minutes", value: 5 },
    { unit: "minutes", value: 0, atStart: true },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalMinutesComputed =
    (Math.max(1, Number(focusMinutes) || 0) +
      Math.max(1, Number(breakMinutes) || 0)) *
    Math.max(1, Number(totalPomodoro) || 0);

  const scheduledAt =
    scheduledDate && scheduledTime
      ? combineDateTime(scheduledDate, scheduledTime)
      : null;

  const normalizedReminders = reminders.filter(() => reminderEnabled);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      setAttachments((prev) => [...prev, file.name]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      setAttachments((prev) => [...prev, file.name]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Session title is required");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error("Pick a date and time for the session");
      return;
    }

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
      attachment_names: attachments.length > 0 ? attachments : undefined,
      reminders: reminderEnabled
        ? normalizedReminders.map((reminder) =>
          reminder.atStart ? 0 : Math.max(1, Number(reminder.value) || 1),
        )
        : [],
      reminder_enabled: reminderEnabled,
      // Give the task ID if it exist (user comes from task)
      task_id: taskId ? Number(taskId) : null,
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
        return;
      }

      toast.success("Study session created");
      router.push("/study");
    } catch {
      toast.error("Network error while creating study session");
    }
  };

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
        <CardHeader className="border-t-2 border-accent rounded-t-xl">
          <CardTitle className="font-display text-lg mt-3.5">
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSession} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">TITLE</Label>
              <Input
                placeholder="e.g. Website Application Design and Security Self-Study"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">TIME</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

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
              <p className="text-xs text-muted-foreground md:col-span-2">
                Defaults are 25 minutes focus and 5 minutes break.
              </p>
            </div>

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
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{file}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
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
                      const reminderTime = scheduledAt
                        ? new Date(
                          scheduledAt.getTime() -
                          valueToMs(
                            reminder.unit,
                            reminder.atStart ? 0 : reminder.value,
                          ),
                        )
                        : null;
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

            <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  AI Suggestions
                </p>
                <p className="text-xs text-muted-foreground">
                  Get session ideas based on your title and attachments.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 font-mono text-xs border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
                onClick={() => toast.info("AI suggestions coming soon!")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Suggestions
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                Create Session
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
