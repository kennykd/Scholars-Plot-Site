import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LogoutButton from "@/app/components/auth/logout-button";
import { ThemeToggle } from "../../components/settings/theme-toggle";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";
import PushNotificationsToggle from "@/app/components/settings/push-notifications-toggle";
import { ProfileDisplayNameForm } from "@/app/components/settings/profile-display-name-form";
import { getUserProfileForSession } from "@/lib/services/userService";

export default async function SettingsPage() {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfileForSession(user);

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
        <CardContent className="pt-4">
          <ProfileDisplayNameForm user={profile} />
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

      <Card className="bg-card border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Notifications
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4">
          <PushNotificationsToggle />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </div>
  );
}