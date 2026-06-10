"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudyQuickTimerCardProps = {
  quickTitle: string;
  quickFocusMinutes: number;
  quickBreakMinutes: number;
  quickTotalMinutes: number;
  onQuickTitleChange: (value: string) => void;
  onQuickFocusMinutesChange: (value: number) => void;
  onQuickBreakMinutesChange: (value: number) => void;
  onQuickTotalMinutesChange: (value: number) => void;
  onCreateQuickTimer: () => void;
};

export function StudyQuickTimerCard({
  quickTitle,
  quickFocusMinutes,
  quickBreakMinutes,
  quickTotalMinutes,
  onQuickTitleChange,
  onQuickFocusMinutesChange,
  onQuickBreakMinutesChange,
  onQuickTotalMinutesChange,
  onCreateQuickTimer,
}: StudyQuickTimerCardProps) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          Quick Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs tracking-wider">TITLE</Label>
          <Input
            placeholder="Timer only"
            value={quickTitle}
            onChange={(e) => onQuickTitleChange(e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs tracking-wider">
              FOCUS MINUTES
            </Label>
            <Input
              type="number"
              min={1}
              value={quickFocusMinutes}
              onChange={(e) =>
                onQuickFocusMinutesChange(Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs tracking-wider">
              BREAK MINUTES
            </Label>
            <Input
              type="number"
              min={1}
              value={quickBreakMinutes}
              onChange={(e) =>
                onQuickBreakMinutesChange(Number(e.target.value))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs tracking-wider">
            TOTAL MINUTES
          </Label>
          <Input
            type="number"
            min={1}
            value={quickTotalMinutes}
            onChange={(e) => onQuickTotalMinutesChange(Number(e.target.value))}
          />
        </div>
        <Button
          onClick={onCreateQuickTimer}
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
        >
          Add Timer
        </Button>
      </CardContent>
    </Card>
  );
}
