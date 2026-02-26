import LogoutButton from "@/app/components/auth/logout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          Dashboard
        </h1>
        <LogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-display text-lg">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Your study dashboard is loading. More widgets coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
