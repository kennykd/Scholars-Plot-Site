"use client";

import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Toggle } from "@/components/ui/toggle";
import LogoutButton from "@/app/components/auth/logout-button";
import { mockUser } from "@/lib/mock-data";
import { Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const displayName = mockUser.displayName ?? mockUser.email;
  const initials = (displayName ?? "U").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">SETTINGS</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">PREFERENCES & PROFILE</p>
      </div>
      
      <Card className="bg-card border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="font-display text-lg">Profile</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4 pt-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={mockUser.avatarUrl} alt={displayName ?? ""} />
            <AvatarFallback className="bg-accent text-accent-foreground text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display text-lg font-bold text-foreground">{displayName}</p>
            <p className="font-mono text-xs text-muted-foreground">{mockUser.email}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="font-display text-lg">Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between pt-4">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="font-mono text-xs text-muted-foreground">{isDark ? "Blueprint (Dark)" : "Light Mode"}</p>
          </div>
          <Toggle pressed={isDark} onPressedChange={(v) => setTheme(v ? "dark" : "light")} aria-label="Toggle dark mode" className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Toggle>
        </CardContent>
      </Card>
      
      <div className="flex justify-end"><LogoutButton /></div>
    </div>
  );
}
