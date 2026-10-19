"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/constants";

/** Wakes a sleeping free-tier API while the visitor reads, before they click Try demo. */
export function ApiWarmup() {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_URL}/health`, { cache: "no-store" }).catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(ping, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(ping, 0);
    return () => clearTimeout(id);
  }, []);

  return null;
}
