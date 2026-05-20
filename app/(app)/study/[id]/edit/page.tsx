"use client";

import { useEffect, useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Paperclip, X } from "lucide-react";
import { format, parseISO } from "date-fns";

const combineDateTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours);
  next.setMinutes(minutes);
  next.setSeconds(0, 0);
  return next;
};

export default function StudyEditPage({ params }: { params: { id: string } }) {
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
  const [loading, setLoading] = useState(true);

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

        setTitle(apiStudy.study_session_name ?? "");
        setNotes(nextNotes);
        setScheduledDate(scheduledAt);
        setScheduledTime(scheduledAt ? format(scheduledAt, "HH:mm") : "");
        setFocusMinutes(apiStudy.focus_minutes ?? 25);
        setBreakMinutes(apiStudy.break_minutes ?? 5);
        setTotalPomodoro(apiStudy.total_pomodoros ?? 2);
        setDescriptionAsChecklist(checklistItems.length > 0);
      } catch {
        toast.error("Network error while loading study session");
        router.push("/study");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router, sessionId]);

  const totalMinutesComputed =
    (Math.max(1, Number(focusMinutes) || 0) +
      Math.max(1, Number(breakMinutes) || 0)) *
    Math.max(1, Number(totalPomodoro) || 0);

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

      toast.success("Study session updated");
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
          <CardTitle className="font-display text-lg">
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEditSession} className="space-y-5 pt-2">
            {/* Insert Title */}
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">TITLE</Label>
              <Input
                placeholder="e.g. Website Application Design and Security Self-Study"
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
                <Label className="font-mono text-xs tracking-wider">TIME</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
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
                  min={1}
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
