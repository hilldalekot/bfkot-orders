"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function ClientIdleTracker() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Initial load check - if there's no staffName, we do nothing
    if (pathname === "/login") return;

    const checkIdleStatus = () => {
      const staffName = localStorage.getItem("staffName");
      if (!staffName || pathname === "/login") return;

      const lastActivityStr = localStorage.getItem("lastActivity");
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
          // User has been idle for more than 5 minutes
          localStorage.removeItem("staffName");
          localStorage.removeItem("lastActivity");
          router.push("/login");
        }
      }
    };

    // Check immediately on mount in case they reopened the tab
    checkIdleStatus();

    // Set up a polling interval to catch them if the tab stays open but idle
    const intervalId = setInterval(checkIdleStatus, 10000); // Check every 10 seconds

    const updateActivity = () => {
      localStorage.setItem("lastActivity", Date.now().toString());
    };

    // Update activity immediately to start the clock
    updateActivity();

    // Listen for activity
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Also check when the tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIdleStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, pathname]);

  return null;
}
