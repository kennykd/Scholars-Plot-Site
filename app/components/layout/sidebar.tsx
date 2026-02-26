"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Timer,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { mockUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/study/timer", label: "Study", icon: Timer },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [logoutLoading, setLogoutLoading] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      const res = await fetch("/api/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (error: unknown) {
      toast.error((error as {message?: string})?.message || "Logout failed");
    } finally {
      setLogoutLoading(false);
    }
  };

  const displayName = mockUser.displayName ?? mockUser.email;
  const initials = (displayName ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen shrink-0 transition-all duration-150 ease-in-out",
          "bg-sidebar",
          collapsed ? "w-20" : "w-72"
        )}
      >
        {/* User avatar section - fixed at top */}
        <div
          className={cn(
            "flex items-center gap-4 px-5 py-5 shrink-0",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={mockUser.avatarUrl} alt={displayName ?? ""} />
            <AvatarFallback className="bg-accent text-accent-foreground text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="font-mono text-xs text-sidebar-foreground/50 truncate">
                {mockUser.email}
              </p>
            </div>
          )}
        </div>

        {/* Navigation - centered vertically */}
        <nav className="flex-1 flex flex-col justify-center py-4 space-y-1 px-3 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"
                      )}
                    />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="font-medium">
                    {label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom section - logout and collapse */}
        <div className="shrink-0 p-3 space-y-2">
          {/* Logout button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-4 w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150",
                  "text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive",
                  collapsed && "justify-center px-0"
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </button>
            </AlertDialogTrigger>
            
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Logout Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to logout?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLogout} 
                  disabled={logoutLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {logoutLoading ? "Logging out..." : "Yes, Logout"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center justify-center w-full rounded-lg p-2 text-sidebar-foreground/50",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150",
              collapsed && "px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
