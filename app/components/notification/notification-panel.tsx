"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X, UserPlus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type InviteStatus = "pending" | "accepted" | "declined";

type ProjectInvite = {
    invite_id: number;
    project_id: number;
    invited_by: string;
    status: InviteStatus;
    created_at: string;
    project: { project_name: string };
    inviter: { user_name: string };
};

type AppNotification = {
    id: number;
    message: string;
    read: boolean;
    created_at: string;
};

interface NotificationPanelProps {
    collapsed?: boolean;
}

export function NotificationPanel({ collapsed = false }: NotificationPanelProps) {
    const [open, setOpen] = useState(false);
    const [invites, setInvites] = useState<ProjectInvite[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [respondingId, setRespondingId] = useState<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // fetch when opened
    useEffect(() => {
        if (!open) return;

        fetch("/api/project/invite")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.invites) setInvites(data.invites);
            })
            .catch(() => { });

        setNotifications([]);
    }, [open]);

    const pendingInvites = invites.filter((i) => i.status === "pending");
    const totalUnread = pendingInvites.length + notifications.filter((n) => !n.read).length;

    const respondToInvite = async (inviteId: number, action: "accept" | "decline") => {
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

            setInvites((prev) =>
                prev.map((i) =>
                    i.invite_id === inviteId ? { ...i, status: action === "accept" ? "accepted" : "declined" } : i
                )
            );

            toast.success(action === "accept" ? "Joined project!" : "Invite declined");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setRespondingId(null);
        }
    };

    return (
        <div ref={panelRef} className="relative w-full">
            {/* Notification Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label="Notifications"
                className={cn(
                    "flex items-center gap-4 w-full rounded-lg text-sm font-medium transition-colors duration-150 relative",
                    "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed ? "justify-center px-0 py-3 h-11" : "px-4 py-3"
                )}
            >
                <div className="relative flex items-center justify-center">
                    <Bell className="h-5 w-5 shrink-0" />
                    {totalUnread > 0 && (
                        <span className={cn(
                            "absolute flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-mono font-bold text-accent-foreground shadow-sm",
                            collapsed ? "-top-1.5 -right-1.5" : "-top-1 -right-2"
                        )}>
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

            {/* Panel sliding out cleanly sideways relative to sidebar boundaries */}
            {open && (
                <div className="absolute left-full bottom-0 ml-3 z-50 w-80 rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                        <h2 className="font-display text-sm font-bold tracking-wide">NOTIFICATIONS</h2>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {/* ── Invites section ── */}
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
                                    <p className="text-xs text-muted-foreground">No pending invites</p>
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
                                                    onClick={() => respondToInvite(invite.invite_id, "accept")}
                                                >
                                                    {respondingId === invite.invite_id ? "..." : "Accept"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs flex-1"
                                                    disabled={respondingId === invite.invite_id}
                                                    onClick={() => respondToInvite(invite.invite_id, "decline")}
                                                >
                                                    Decline
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── General notifications section ── */}
                        <div className="border-t border-border/50">
                            <div className="px-4 py-2 border-b border-border/30 bg-muted/20 flex items-center gap-2">
                                <Info className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                    GENERAL
                                </span>
                            </div>

                            {notifications.length === 0 ? (
                                <div className="px-4 py-5 text-center">
                                    <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                "px-4 py-3",
                                                !n.read && "bg-accent/5 border-l-2 border-l-accent"
                                            )}
                                        >
                                            <p className="text-sm text-foreground">{n.message}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                {new Date(n.created_at).toLocaleDateString()}
                                            </p>
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