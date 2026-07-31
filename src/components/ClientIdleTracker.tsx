"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ClientIdleTracker() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 5 minutes = 300000 ms
      timeoutId = setTimeout(() => {
        const staffName = localStorage.getItem("staffName");
        if (staffName && pathname !== "/login") {
          localStorage.removeItem("staffName");
          // Optionally remove other auth-related local storage if any
          router.push("/login");
        }
      }, 300000);
    };

    resetTimer();

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [router, pathname]);

  return null;
}
