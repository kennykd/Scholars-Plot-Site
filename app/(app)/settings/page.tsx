import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LogoutButton from "@/app/components/auth/logout-button";
import { ThemeToggle } from "../../components/settings/theme-toggle";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  const displayName = user?.name ?? user?.email.split("@")[0] ?? "User";
  const avatarSrc = user?.image?.trim() || undefined;
  const initials = (displayName ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          SETTINGS
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          PREFERENCES & PROFILE
        </p>
      </div>

      <Card className="bg-card border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4 pt-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarSrc} alt={displayName ?? ""} />
            <AvatarFallback className="bg-accent text-accent-foreground text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display text-lg font-bold text-foreground">
              {displayName}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {user?.email ?? ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ThemeToggle />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </div>
  );
}
