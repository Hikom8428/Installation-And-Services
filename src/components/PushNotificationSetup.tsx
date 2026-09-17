"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    plugins?: { OneSignal?: any };
    OneSignalDeferred?: any[];
  }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

interface Props {
  userId: string;
}

// Registers the logged-in user for push notifications and links the
// subscription to our own User.id via OneSignal's "External ID" (so the
// server can target notifications with just that id — no device-token
// table to maintain). Branches between the native Android plugin
// (onesignal-cordova-plugin, inside the Capacitor app) and the OneSignal
// Web SDK (a normal browser tab). No-ops if OneSignal isn't configured.
export default function PushNotificationSetup({ userId }: Props) {
  useEffect(() => {
    if (!ONESIGNAL_APP_ID || !userId) return;

    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");

      if (Capacitor.isNativePlatform()) {
        const setupNative = () => {
          if (cancelled) return;
          const OneSignal = window.plugins?.OneSignal;
          if (!OneSignal) return;
          OneSignal.initialize(ONESIGNAL_APP_ID);
          OneSignal.Notifications.requestPermission(true);
          OneSignal.login(userId);
        };

        if (window.plugins?.OneSignal) {
          setupNative();
        } else {
          document.addEventListener("deviceready", setupNative, { once: true });
        }
      } else {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        if (!document.getElementById("onesignal-sdk")) {
          const script = document.createElement("script");
          script.id = "onesignal-sdk";
          script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
          script.defer = true;
          document.head.appendChild(script);
        }
        window.OneSignalDeferred.push(async (OneSignal: any) => {
          if (cancelled) return;
          await OneSignal.init({ appId: ONESIGNAL_APP_ID });
          await OneSignal.login(userId);
          try {
            await OneSignal.Notifications.requestPermission();
          } catch {
            /* dismissed or unsupported browser — non-fatal */
          }
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
