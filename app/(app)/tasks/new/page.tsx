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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StarRating } from "@/app/components/common/star-rating";
import { toast } from "sonner";
import { StudySessionPrompt } from "@/app/components/tasks/study-session-prompt";
import { format } from "date-fns";
import { CalendarIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [reminder, setReminder] = useState("none");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setAttachment(file.name);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task name is required");
      return;
    }
    if (!deadline) {
      toast.error("Deadline is required");
      return;
    }
    toast.success("Task created! 🎉");
    setShowPrompt(true);
  };

  return (
    <>
      {showPrompt && (
        <StudySessionPrompt
          taskName={title}
          onSkip={() => router.push("/tasks")}
        />
      )}
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            NEW TASK
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            CREATE A NEW TASK
          </p>
        </div>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2">
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

              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  DEADLINE *
                </Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button
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
                  className="resize-y min-h-[80px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  ATTACHMENT
                </Label>
                {attachment ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">
                      {attachment}
                    </span>
                    <button type="button" onClick={() => setAttachment(null)}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 px-4 py-6 cursor-pointer hover:border-accent/50 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <Paperclip className="h-6 w-6 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">
                      Drop file here or click to browse
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  PRIORITY
                </Label>
                <div className="flex items-center gap-3">
                  <StarRating
                    value={priority}
                    onChange={setPriority}
                    size="lg"
                  />
                  <span className="font-mono text-sm text-muted-foreground">
                    {priority.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  REMINDER
                </Label>
                <Select value={reminder} onValueChange={setReminder}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="every-3-days">Every 3 Days</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                >
                  Create Task
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/tasks">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
