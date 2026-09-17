"use client";

import { useEffect } from "react";

// No-ops entirely in a normal browser tab. Inside the Capacitor Android app,
// wires the hardware/gesture back button to browser history instead of the
// default (which would otherwise close the app on the very first back-press).
export default function CapacitorBackButton() {
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("backButton", () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
      removeListener = () => listener.remove();
    })();

    return () => removeListener?.();
  }, []);

  return null;
}
