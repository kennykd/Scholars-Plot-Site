"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

type AiSuggestionsButtonProps = {
  /** Helper text shown next to the button explaining what it suggests. */
  description?: string;
};

/**
 * Accent-bordered "AI Suggestions" call-to-action. Frontend-only for now —
 * clicking shows a "coming soon" toast.
 */
export function AiSuggestionsButton({
  description = "Get suggestions based on what you've entered so far.",
}: AiSuggestionsButtonProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">AI Suggestions</p>
        <p className="text-xs text-muted-foreground">{description}</p>
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
  );
}
