"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY } from "@/lib/analyticsExclude";

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    try {
      if (typeof window !== "undefined" && localStorage.getItem(ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY) === "1") {
        return;
      }
    } catch {
      /* private mode / blocked storage */
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
