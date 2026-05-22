"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (event: "release", listener: () => void) => void;
};

type NavigatorWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

type BatteryManagerLike = {
  level: number;
  charging: boolean;
  addEventListener: (
    event: "levelchange" | "chargingchange",
    listener: () => void,
  ) => void;
  removeEventListener: (
    event: "levelchange" | "chargingchange",
    listener: () => void,
  ) => void;
};

export default function Home() {
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryIsCharging, setBatteryIsCharging] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as NavigatorWakeLock;

    if (!nav.wakeLock?.request || wakeLockRef.current) {
      return;
    }

    try {
      const wakeLock = await nav.wakeLock.request("screen");
      wakeLockRef.current = wakeLock;
      wakeLock.addEventListener("release", () => {
        wakeLockRef.current = null;

        if (document.visibilityState === "visible") {
          void requestWakeLock();
        }
      });
    } catch {
      // Some browsers require user interaction before wake lock can be requested.
    }
  }, []);

  useEffect(() => {
    let batteryRef: BatteryManagerLike | null = null;

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };

    if (!nav.getBattery) {
      return;
    }

    const updateBattery = () => {
      if (!batteryRef) {
        return;
      }
      setBatteryLevel(Math.round(batteryRef.level * 100));
      setBatteryIsCharging(batteryRef.charging);
    };

    void nav.getBattery().then((battery) => {
      batteryRef = battery;
      updateBattery();
      battery.addEventListener("levelchange", updateBattery);
      battery.addEventListener("chargingchange", updateBattery);
    });

    return () => {
      if (!batteryRef) {
        return;
      }
      batteryRef.removeEventListener("levelchange", updateBattery);
      batteryRef.removeEventListener("chargingchange", updateBattery);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, [requestWakeLock]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      await requestWakeLock();
    } catch {
      // Fullscreen is best-effort and can fail in unsupported contexts.
    }
  }, [requestWakeLock]);

  const { hour, minute, second, blinkOn } = useMemo(() => {
    const hours24 = now.getHours();
    const hours12 = hours24 % 12 || 12;

    return {
      hour: String(hours12).padStart(2, "0"),
      minute: String(now.getMinutes()).padStart(2, "0"),
      second: String(now.getSeconds()).padStart(2, "0"),
      blinkOn: now.getSeconds() % 2 === 0,
    };
  }, [now]);

  const isEvenMinute = now.getMinutes() % 2 === 0;

  const dateText = useMemo(
    () =>
      `${new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(now)} - ${new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
      }).format(now)}`,
    [now],
  );

  return (
    <main className="clock-screen" aria-label="No sleep clock screen">
      {batteryLevel !== null && (
        <div
          className={`battery-bar-track${isEvenMinute ? " is-top" : " is-bottom"}`}
          aria-label={`Battery ${batteryLevel}%`}
        >
          <div
            className={`battery-bar-fill${batteryIsCharging ? " is-charging" : ""}${
              batteryLevel < 20 ? " is-low" : ""
            }`}
            style={{ width: `${batteryLevel}%` }}
          />
        </div>
      )}

      {!isFullscreen && (
        <button
          type="button"
          className="fullscreen-toggle"
          onClick={() => void toggleFullscreen()}
          aria-label="Enter fullscreen"
        >
          Fullscreen
        </button>
      )}

      <div className="clock-content">
        <h1 className="clock-time" aria-live="polite">
          <span>{hour}</span>
          <span className={`clock-separator${blinkOn ? "" : " is-dim"}`}>:</span>
          <span>{minute}</span>
          <span className={`clock-separator${blinkOn ? "" : " is-dim"}`}>:</span>
          <span>{second}</span>
        </h1>
        <p className="clock-date">{dateText}</p>
      </div>
    </main>
  );
}
