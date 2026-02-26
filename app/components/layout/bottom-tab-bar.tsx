"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Timer,
  MoreHorizontal,
  BarChart3,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const primaryTabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/study/timer", label: "Study", icon: Timer },
];

const moreTabs = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();

  const isMoreActive = moreTabs.some(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/")
  );

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16",
        "bg-sidebar border-t border-sidebar-border",
        "flex items-center justify-around",
        "pb-safe" // safe-area for notched phones
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {primaryTabs.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
              "text-xs font-medium transition-colors duration-150",
              isActive
                ? "text-accent"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-accent")} />
            <span className="font-mono text-[10px]">{label}</span>
          </Link>
        );
      })}

      {/* More sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
              "text-xs font-medium transition-colors duration-150",
              isMoreActive
                ? "text-accent"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5", isMoreActive && "text-accent")} />
            <span className="font-mono text-[10px]">More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="bg-sidebar border-t border-sidebar-border rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="font-display text-sidebar-foreground">More</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 pb-6">
            {moreTabs.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
