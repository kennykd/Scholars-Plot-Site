"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileDisplayNameFormProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

function fallbackDisplayName(user: ProfileDisplayNameFormProps["user"]) {
  return user.name?.trim() || user.email.split("@")[0] || "User";
}

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ProfileDisplayNameForm({ user }: ProfileDisplayNameFormProps) {
  const router = useRouter();
  const [savedName, setSavedName] = useState(fallbackDisplayName(user));
  const [displayName, setDisplayName] = useState(savedName);
  const [saving, setSaving] = useState(false);

  const trimmedName = displayName.trim();
  const avatarSrc = user.image?.trim() || undefined;
  const initials = useMemo(() => getInitials(savedName), [savedName]);
  const canSave = trimmedName.length > 0 && trimmedName !== savedName && !saving;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const firstError =
          data?.errors && typeof data.errors === "object"
            ? Object.values(data.errors).flat()[0]
            : null;
        throw new Error(firstError ?? data?.message ?? data?.error ?? "Failed to update display name");
      }

      const nextName = data?.user?.name?.trim() || trimmedName;
      setSavedName(nextName);
      setDisplayName(nextName);
      toast.success("Display name updated");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update display name",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatarSrc} alt={savedName} />
          <AvatarFallback className="bg-accent text-accent-foreground text-lg font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-foreground truncate">
            {savedName}
          </p>
          <p className="font-mono text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="profile-display-name"
          className="font-mono text-xs tracking-wider"
        >
          DISPLAY NAME
        </Label>
        <div className="flex items-center gap-2">
        <Input
          id="profile-display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={100}
        />
        <div className="flex justify-end">
        <Button type="submit" disabled={!canSave}>
          {saving ? "Saving..." : "Save Name"}
        </Button>
      </div>

        </div>
        
      </div>

      
    </form>
  );
}
