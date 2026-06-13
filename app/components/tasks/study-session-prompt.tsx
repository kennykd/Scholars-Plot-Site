"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";

interface StudySessionPromptProps {
  taskName: string;
  onPlan: () => void;
  onSkip: () => void;
}

export function StudySessionPrompt({
  taskName,
  onPlan,
  onSkip,
}: StudySessionPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <Card className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-card/95 border border-accent/30 shadow-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
              <Timer className="h-5 w-5 text-accent" />
            </div>
            <CardTitle className="font-display text-lg">
              <h2>Schedule Study Sessions?</h2>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            You just created{" "}
            <span className="font-medium text-foreground">
              &quot;{taskName}&quot;
            </span>
            . Would you like to schedule focused study sessions to tackle it?
          </p>
          <p className="font-mono text-xs text-accent/80">
            Students who plan study sessions complete tasks 40% faster.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onPlan}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              <Timer className="h-4 w-4 mr-2" /> Plan Study Sessions
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSkip}
              className="font-mono text-xs"
            >
              Not now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
