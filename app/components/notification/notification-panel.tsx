"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Info, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InviteStatus = "pending" | "accepted" | "declined";
type InviteResponseAction = "accepted" | "declined";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  read: boolean;
  createdAt: string;
};

type ProjectInvite = {
  invite_id: number;
  project_id: number;
  invited_by: string;
  status: InviteStatus;
  created_at: string;
  project: { project_name: string };
  inviter: { user_name: string };
};

interface NotificationPanelProps {
  collapsed?: boolean;
  userId?: string;
}

export function NotificationPanel({
  collapsed = false,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications);
      }
    } catch {
      // Keep the tray usable even if the general inbox cannot load.
    }
  }, []);

  const refreshInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/project/invite");
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.invites)) {
        setInvites(data.invites);
      }
    } catch {
      // The notification tray should stay usable even when invites cannot load.
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    void refreshInvites();
  }, [refreshInvites, refreshNotifications]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "WEB_PUSH_NOTIFICATION_RECEIVED") return;

      void refreshNotifications();
    };

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    };
  }, [refreshNotifications]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    void refreshInvites();
    void refreshNotifications();
  }, [open, refreshInvites, refreshNotifications]);

  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const totalUnread =
    pendingInvites.length + notifications.filter((notification) => !notification.read).length;

  const dismissNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id),
      );

      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        });

        if (!res.ok) {
          await refreshNotifications();
        }
      } catch {
        await refreshNotifications();
      }
    },
    [refreshNotifications],
  );

  const respondToInvite = async (
    inviteId: number,
    action: InviteResponseAction,
  ) => {
    setRespondingId(inviteId);

    try {
      const res = await fetch(`/api/project/invite/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to respond to invite");
      }

      setInvites((prev) => prev.filter((invite) => invite.invite_id !== inviteId));
      toast.success(action === "accepted" ? "Joined project!" : "Invite declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div ref={panelRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        className={cn(
          "flex items-center gap-4 w-full rounded-lg text-sm font-medium transition-colors duration-150 relative",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          collapsed ? "justify-center px-0 py-3 h-11" : "px-4 py-3",
        )}
      >
        <div className="relative flex items-center justify-center">
          <Bell className="h-5 w-5 shrink-0" />
          {totalUnread > 0 && (
            <span
              className={cn(
                "absolute flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-mono font-bold text-accent-foreground shadow-sm",
                collapsed ? "-top-1.5 -right-1.5" : "-top-1 -right-2",
              )}
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </div>

        {!collapsed && (
          <span className="flex-1 text-left transition-opacity duration-150">
            Notifications
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "fixed bottom-24 z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150",
            collapsed ? "left-[5.75rem]" : "left-[18.75rem]",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <h2 className="font-display text-sm font-bold tracking-wide">
              NOTIFICATIONS
            </h2>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <div>
              <div className="px-4 py-2 border-b border-border/30 bg-muted/20 flex items-center gap-2">
                <UserPlus className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  PROJECT INVITES
                </span>
                {pendingInvites.length > 0 && (
                  <Badge className="ml-auto text-[9px] px-1.5 py-0 bg-accent text-accent-foreground">
                    {pendingInvites.length}
                  </Badge>
                )}
              </div>

              {pendingInvites.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-muted-foreground">
                    No pending invites
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {pendingInvites.map((invite) => (
                    <div key={invite.invite_id} className="px-4 py-3 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {invite.project.project_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Invited by {invite.inviter.user_name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                          disabled={respondingId === invite.invite_id}
                          onClick={() => respondToInvite(invite.invite_id, "accepted")}
                        >
                          {respondingId === invite.invite_id ? "..." : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          disabled={respondingId === invite.invite_id}
                          onClick={() => respondToInvite(invite.invite_id, "declined")}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/50">
              <div className="px-4 py-2 border-b border-border/30 bg-muted/20 flex items-center gap-2">
                <Info className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  GENERAL
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-muted-foreground">
                    You&apos;re all caught up
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-2 px-4 py-3",
                        !notification.read && "bg-accent/5 border-l-2 border-l-accent",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Dismiss ${notification.title}`}
                        onClick={() => void dismissNotification(notification.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
