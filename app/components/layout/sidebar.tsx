"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { mockUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
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
          "bg-sidebar border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* User avatar section */}
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-4 border-b border-sidebar-border",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-accent/40">
            <AvatarImage src={mockUser.avatarUrl} alt={displayName ?? ""} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="font-mono text-xs text-sidebar-foreground/50 truncate">
                {mockUser.email}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-sidebar-primary/15 text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                      )}
                    />
                    {!collapsed && <span>{label}</span>}
                    {/* Active indicator bar */}
                    {isActive && !collapsed && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                    )}
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

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center justify-center w-full rounded-lg p-2 text-sidebar-foreground/50",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
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
