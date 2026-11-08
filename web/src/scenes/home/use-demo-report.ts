// The example report the home page draws from, so every number on it is real data.
"use client";
import { useLoad } from "@/components/providers";
import { atto } from "@/lib/atto/client";

export const DEMO_NAME = "bakery.food";

export function useDemoReport() {
  return useLoad(() => atto.getReport(DEMO_NAME), [DEMO_NAME]);
}
