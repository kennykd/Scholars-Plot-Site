import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function StudyPageHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          STUDY SESSIONS
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          UPCOMING STUDY PLAN
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          asChild
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
        >
          <Link href="/study/new">
            <Plus className="h-4 w-4 mr-1" /> New Session
          </Link>
        </Button>
      </div>
    </div>
  );
}
