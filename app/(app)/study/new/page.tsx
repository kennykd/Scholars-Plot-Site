"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { mockStudySessions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Paperclip, X } from "lucide-react";
import { format } from "date-fns";

type StudySessionLocal = {
  id: string;
  title: string;
  notes: string;
  attachments: string[];
  scheduledAt: string;
  focusMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  status: "planned" | "in-progress" | "completed";
  createdAt: string;
  isTimerOnly?: boolean;
};

const STORAGE_KEY = "scholarsPlot.studySessions";

const seedSessions = (): StudySessionLocal[] =>
  mockStudySessions.map((session) => ({
    id: session.id,
    title: session.taskTitle ?? "Study Session",
    notes: "",
    attachments: [],
    scheduledAt: (session.scheduledAt ?? new Date()).toISOString(),
    focusMinutes: session.duration ?? 25,
    breakMinutes: session.breakDuration ?? 5,
    totalMinutes: 60,
    status: session.status === "completed" ? "completed" : "planned",
    createdAt: new Date().toISOString(),
  }));

const combineDateTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours);
  next.setMinutes(minutes);
  next.setSeconds(0, 0);
  return next;
};

export default function StudyNewPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StudySessionLocal[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalMinutes, setTotalMinutes] = useState(60);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        setSessions(JSON.parse(stored));
      } catch {
        setSessions(seedSessions());
      }
    } else {
      setSessions(seedSessions());
    }
    setHydrated(true);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((file) => file.name)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files.map((file) => file.name)]);
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Session title is required");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error("Pick a date and time for the session");
      return;
    }

    const scheduledAt = combineDateTime(scheduledDate, scheduledTime);
    const newSession: StudySessionLocal = {
      id: `session-${Date.now()}`,
      title: title.trim(),
      notes: notes.trim(),
      attachments,
      scheduledAt: scheduledAt.toISOString(),
      focusMinutes: Math.max(1, Number(focusMinutes) || 25),
      breakMinutes: Math.max(1, Number(breakMinutes) || 5),
      totalMinutes: Math.max(1, Number(totalMinutes) || 60),
      status: "planned",
      isTimerOnly: false,
      createdAt: new Date().toISOString(),
    };

    const nextSessions = [newSession, ...sessions].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions));
    }

    setSessions(nextSessions);
    toast.success("Study session created");
    router.push("/study");
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
        <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2">
          <CardTitle className="font-display text-lg">
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSession} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">TITLE</Label>
              <Input
                placeholder="e.g. Biology Chapter 6 Review"
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
                      initialFocus
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

            <div className="space-y-2">
              <Label className="font-mono text-xs tracking-wider">
                TOTAL DURATION (MINUTES)
              </Label>
              <Input
                type="number"
                min={1}
                value={totalMinutes}
                onChange={(e) => setTotalMinutes(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Total: {totalMinutes}m
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs tracking-wider">NOTES</Label>
              <Textarea
                placeholder="Add goals or notes for this session..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-y min-h-[90px]"
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
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                  />
                </label>
              )}
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
