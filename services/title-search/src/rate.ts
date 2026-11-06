import {
  fingerprint,
  SECTION_KEYS,
  type Report,
  type Manifest,
  type SectionKey,
  type ReportSection,
  type NetworkId,
} from "@atto/shared";
export function rate(
  name: string,
  network: NetworkId,
  partial: Partial<Record<SectionKey, ReportSection>>,
  sources: string[],
  nfts: Manifest["nfts"] = [],
  final = false,
): Report {
  const sections = Object.fromEntries(
    SECTION_KEYS.map((key) => [
      key,
      partial[key] ?? {
        title: key.replaceAll("_", " "),
        status: "unavailable",
        lines: [],
        note: "This read is not available.",
      },
    ]),
  ) as Report["sections"];
  const counts = { Clean: 0, WillBeCleared: 0, NeedsSeller: 0 };
  for (const section of Object.values(sections)) for (const line of section.lines) counts[line.rating]++;
  const manifest: Manifest = {
    token_id: name,
    intents_keys: sections.intents_keys.lines.map((l) => l.label).sort(),
    intents_floor: sections.intents_balances.lines
      .map((l) => ({ token_id: l.label, amount: l.detail }))
      .sort((a, b) => a.token_id.localeCompare(b.token_id)),
    nfts: [...nfts].sort((a, b) => `${a.contract_id}/${a.token_id}`.localeCompare(`${b.contract_id}/${b.token_id}`)),
    needs_seller: Object.values(sections)
      .flatMap((s) =>
        s.lines.filter((l) => l.rating === "NeedsSeller").map((l) => `${l.label}: ${l.ask_seller ?? l.detail}`),
      )
      .sort(),
  };
  const incomplete = Object.entries(sections)
    .filter(([key, s]) => s.status === "unavailable" && key !== "keeper_reserve")
    .map(([, s]) => s.title);
  const blocked = ["owner", "lease", "wallet", "name_keys", "intents_mode"].some((key) =>
    sections[key as SectionKey].lines.some((line) => line.rating === "NeedsSeller"),
  );
  return {
    name,
    network,
    built_at: new Date().toISOString(),
    final,
    sources,
    sections,
    counts,
    clean_sale: {
      supported: !incomplete.length && !blocked,
      reason: incomplete.length
        ? `Incomplete coverage: ${incomplete.join(", ")}.`
        : blocked
          ? "The seller must resolve the blocking access or lease items first."
          : undefined,
    },
    manifest,
    fingerprint: fingerprint(manifest),
  };
}
