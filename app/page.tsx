"use client";

import { useEffect, useMemo, useState } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (event: "release", listener: () => void) => void;
};

type NavigatorWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export default function Home() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let wakeLock: WakeLockSentinelLike | null = null;

    const requestWakeLock = async () => {
      const nav = navigator as NavigatorWakeLock;

      if (!nav.wakeLock?.request) {
        return;
      }

      try {
        wakeLock = await nav.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
        });
      } catch {
        // Some browsers require user interaction before wake lock can be requested.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLock) {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLock) {
        void wakeLock.release();
      }
    };
  }, []);

  const timeText = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now),
    [now],
  );

  const dateText = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(now),
    [now],
  );

  return (
    <main className="clock-screen" aria-label="No sleep clock screen">
      <h1 className="clock-time">{timeText}</h1>
      <p className="clock-date">{dateText}</p>
    </main>
  );
}
