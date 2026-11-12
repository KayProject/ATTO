// The example report the home page draws from, so every number on it is real data.
"use client";
import { useLoad } from "@/components/providers";
import { EXAMPLE_NAMES } from "@/lib/atto/backend";
import { atto } from "@/lib/atto/client";

// A real name on a wallet network, the seeded one on demo data.
export const DEMO_NAME = EXAMPLE_NAMES[0] ?? "bakery.food";

export function useDemoReport() {
  return useLoad(() => atto.getReport(DEMO_NAME), [DEMO_NAME]);
}
