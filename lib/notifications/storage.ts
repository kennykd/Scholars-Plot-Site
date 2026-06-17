export type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  read: boolean;
  createdAt: string;
};

export const NOTIFICATION_STORAGE_KEY = "scholars-plot:notifications";
export const NOTIFICATIONS_UPDATED_EVENT = "scholars-plot:notifications-updated";
const MAX_STORED_NOTIFICATIONS = 30;

/**
 * Web-push notifications are cached per-user so switching accounts in the same
 * browser never surfaces another user's history. Falls back to the bare key
 * when no user id is available (e.g. before the profile is known).
 */
export function notificationStorageKey(userId?: string | null) {
  return userId
    ? `${NOTIFICATION_STORAGE_KEY}:${userId}`
    : NOTIFICATION_STORAGE_KEY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function readStoredNotifications(storageKey: string): AppNotification[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    );

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): AppNotification | null => {
        if (!isRecord(item)) return null;

        const message = stringValue(item.message);
        const title = stringValue(item.title) ?? message ?? "Notification";
        const body = stringValue(item.body) ?? (message !== title ? message : "") ?? "";
        const url = stringValue(item.url) ?? "/";
        const tag = stringValue(item.tag) ?? `${url}:${title}`;
        const id = stringValue(item.id) ?? tag;
        const createdAt =
          stringValue(item.createdAt) ??
          stringValue(item.created_at) ??
          new Date().toISOString();

        return {
          id,
          title,
          body,
          url,
          tag,
          read: typeof item.read === "boolean" ? item.read : false,
          createdAt,
        };
      })
      .filter((item): item is AppNotification => item !== null)
      .slice(0, MAX_STORED_NOTIFICATIONS);
  } catch {
    return [];
  }
}

export function writeStoredNotifications(
  storageKey: string,
  notifications: AppNotification[],
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    storageKey,
    JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS)),
  );
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export function notificationFromPushPayload(
  payload: unknown,
): AppNotification | null {
  if (!isRecord(payload)) return null;

  const data = isRecord(payload.data) ? payload.data : {};
  const title = stringValue(payload.title) ?? "Notification";
  const body = stringValue(payload.body) ?? "";
  const url = stringValue(data.url) ?? stringValue(payload.url) ?? "/";
  const tag = stringValue(payload.tag) ?? `${url}:${title}`;

  return {
    id: tag,
    title,
    body,
    url,
    tag,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function upsertStoredNotification(
  storageKey: string,
  notification: AppNotification,
) {
  const existing = readStoredNotifications(storageKey).filter(
    (item) => item.tag !== notification.tag && item.id !== notification.id,
  );
  const next = [notification, ...existing].slice(0, MAX_STORED_NOTIFICATIONS);
  writeStoredNotifications(storageKey, next);
  return next;
}

/** Remove a single stored notification by id and persist the result. */
export function removeStoredNotification(storageKey: string, id: string) {
  const next = readStoredNotifications(storageKey).filter(
    (item) => item.id !== id,
  );
  writeStoredNotifications(storageKey, next);
  return next;
}

/**
 * Wipe every per-user notification bucket from this browser. Used on logout so
 * cached notifications never outlive the session that received them.
 */
export function clearAllStoredNotifications() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(NOTIFICATION_STORAGE_KEY)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}
