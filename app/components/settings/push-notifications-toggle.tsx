"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function refreshServiceWorkerRegistration() {
  const existingRegistration =
    await navigator.serviceWorker.getRegistration("/");
  if (existingRegistration) {
    await existingRegistration.unregister();
  }

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function getServiceWorkerRegistration() {
  const existingRegistration =
    await navigator.serviceWorker.getRegistration("/");
  if (existingRegistration) return existingRegistration;

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

function getClientVapidKey() {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    (window as Window & { __NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string })
      .__NEXT_PUBLIC_VAPID_PUBLIC_KEY
  );
}

export default function PushNotificationsToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const ensureRegistrationAndCheck = async () => {
      try {
        const reg = await getServiceWorkerRegistration();
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch (err) {
        console.error("Push init error:", err);
        setMessage(
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : "Push notifications is not supported in this browser!",
        );
      }
    };
    ensureRegistrationAndCheck();
  }, [isSupported]);

  const subscribe = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (Notification.permission === "denied") {
        setMessage("Notification permission denied in your browser settings.");
        return;
      }

      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setMessage("Please allow notifications for this site!");
          return;
        }
      }

      const vapidKey = getClientVapidKey();
      if (!vapidKey) {
        setMessage("Push notifications are not configured for this app.");
        return;
      }

      const reg = await getServiceWorkerRegistration();
      if (!reg) throw new Error("Service worker not ready");

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        try {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } catch (firstError) {
          console.warn(
            "Subscribe failed on current registration, refreshing SW once:",
            firstError,
          );
          const refreshedRegistration = await refreshServiceWorkerRegistration();
          subscription =
            (await refreshedRegistration.pushManager.getSubscription()) ??
            (await refreshedRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            }));
        }
      }

      const resp = await fetch("/api/web-push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          subscription.toJSON() ? subscription.toJSON() : subscription,
        ),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("Server subscribe failed:", resp.status, body);
        setMessage("Server rejected the notification request.");
        return;
      }

      setIsSubscribed(true);
      console.log("Subscribed to push notifications.");
    } catch (error) {
      console.error("Subscribe error:", error);
      setMessage(
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "Failed to subscribe. Check console for details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        console.log("No active subscription found.");
        return;
      }

      const unsubbed = await subscription.unsubscribe();
      if (!unsubbed) {
        setMessage("Unable to stop push notification services");
        return;
      }

      const resp = await fetch("/api/web-push/unsubscribe", {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("Server unsubscribe failed:", resp.status, body);
        setMessage("Server failed to disable notifications!");
        return;
      }

      setIsSubscribed(false);
      console.log("Unsubscribed from push notifications.");
    } catch (err) {
      console.error("Unsubscribe error:", err);
      console.log(
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : "Failed to unsubscribe. Check console for details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported)
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications are not supported in this browser.
      </p>
    );

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold">Push Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Receive updates in your browser.
        </p>
        {message && <p className="text-sm text-red-600 mt-1">{message}</p>}
      </div>

      <div>
        <button
          onClick={() => {
            if (loading) return;
            if (isSubscribed) unsubscribe();
            else subscribe();
          }}
          disabled={loading}
          className={`px-4 py-2 rounded font-medium text-white ${isSubscribed ? "bg-green-600 hover:bg-green-700" : "bg-gray-500 hover:bg-gray-600"} disabled:opacity-60`}
        >
          {loading ? "Updating..." : isSubscribed ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
