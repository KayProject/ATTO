import type { ChangedAnswer, HistoryEvent, HistoryKind } from "./types";

const OWNER_CHANGES: HistoryKind[] = ["transferred", "sold_clean", "reclaimed", "re_rented"];

/** Answers "has this name changed owner in the last `days` days?" from its history. */
export function changedAnswer(events: HistoryEvent[], days: number, now: Date): ChangedAnswer {
  const since = now.getTime() - days * 24 * 3600 * 1000;
  const latest = events
    .filter((e) => OWNER_CHANGES.includes(e.kind) && new Date(e.block_time).getTime() >= since)
    .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime())[0];
  if (!latest) return { changed: false };
  return { changed: true, at: latest.block_time, kind: latest.kind, previous_owner: latest.from_owner };
}

export const KIND_LABEL: Record<HistoryKind, string> = {
  minted: "First rented",
  transferred: "Transferred",
  sold_clean: "Clean Sale",
  renewed: "Renewed",
  renewed_by_keeper: "Renewed by Keeper",
  reclaimed: "Reclaimed by the registry",
  re_rented: "Re-rented",
};
