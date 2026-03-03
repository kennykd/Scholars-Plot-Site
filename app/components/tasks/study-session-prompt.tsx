"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer } from "lucide-react";

interface StudySessionPromptProps {
  taskName: string;
  onSkip: () => void;
}

export function StudySessionPrompt({
  taskName,
  onSkip,
}: StudySessionPromptProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Card className="w-full max-w-md bg-card/95 border border-accent/30 shadow-2xl">
        <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
              <Timer className="h-5 w-5 text-accent" />
            </div>
            <CardTitle className="font-display text-lg">
              Schedule Study Sessions?
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
            💡 Students who plan study sessions complete tasks 40% faster.
          </p>
          <div className="flex gap-3">
            <Button
              asChild
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              <Link href="/study">
                <Timer className="h-4 w-4 mr-2" /> Schedule Study Sessions
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={onSkip}
              className="font-mono text-xs"
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
