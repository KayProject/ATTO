// Preview of the glass tag and the cast in every state.
"use client";
import { useState } from "react";
import type { Report } from "@atto/shared";
import { useLoad } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { PillButton } from "@/components/ui/pill-button";
import { GlassTag } from "@/scenes/tag/glass-tag";
import { CastObject, CAST_KINDS } from "@/scenes/tag/cast";
import { cordsFor } from "@/scenes/tag/cords";

/** The same report with its NFT section marked unreadable, to preview the dashed cord. */
function withUnreadSection(report: Report): Report {
  const copy = structuredClone(report);
  copy.sections.nfts = { ...copy.sections.nfts, status: "unavailable", lines: [], note: "Preview: this section could not be read." };
  return copy;
}

export default function TagLab() {
  const bakery = useLoad(() => atto.getReport("bakery.food"), ["bakery.food"]);
  const guild = useLoad(() => atto.getReport("guild.food"), ["guild.food"]);
  const clean = useLoad(() => atto.getReport("clean.pay"), ["clean.pay"]);
  const [cut, setCut] = useState(false);

  const report = bakery.data;
  if (!report) return <p className="tag-lab-wait">Loading reports</p>;
  const unread = withUnreadSection(report);

  return (
    <div className="tag-lab">
      <section className="tag-lab-band tag-lab-night">
        <h1>bakery.food, live report</h1>
        <GlassTag name={report.name} cords={cordsFor(report, cut ? 99 : 0)} size="hero" stamped={cut} />
        <PillButton tone="secondary" state={cut ? "done" : "idle"} onClick={() => setCut((v) => !v)}>
          {cut ? "Put the cords back" : "Cut what ATTO clears"}
        </PillButton>
      </section>

      <section className="tag-lab-band tag-lab-ground">
        <h2>Every clearable cord cut, stamped</h2>
        <GlassTag name={report.name} cords={cordsFor(report, 99)} size="panel" stamped />
      </section>

      <section className="tag-lab-band tag-lab-sky">
        <h2>A section ATTO couldn&apos;t read</h2>
        <GlassTag name={unread.name} cords={cordsFor(unread, 0)} size="panel" />
      </section>

      <section className="tag-lab-band tag-lab-ground">
        <h2>Inline</h2>
        <div className="tag-lab-row">
          <GlassTag name={report.name} cords={cordsFor(report, 0)} size="inline" />
          {guild.data && <GlassTag name={guild.data.name} cords={cordsFor(guild.data, 0)} size="inline" />}
          <GlassTag name={unread.name} cords={cordsFor(unread, 0)} size="inline" />
          {clean.data && <GlassTag name={clean.data.name} cords={cordsFor(clean.data, 0)} size="inline" stamped />}
        </div>
      </section>

      <section className="tag-lab-band tag-lab-ground">
        <h2>Cast</h2>
        <ul className="tag-lab-cast">
          {CAST_KINDS.map((kind) => (
            <li key={kind}>
              <CastObject kind={kind} size={96} label={kind} />
              <CastObject kind={kind} size={96} cut label={`${kind}, cut`} />
              <span>{kind}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tag-lab-band tag-lab-night">
        <h2>Cast at night</h2>
        <ul className="tag-lab-cast">
          {CAST_KINDS.map((kind) => (
            <li key={kind}>
              <CastObject kind={kind} size={72} />
              <CastObject kind={kind} size={72} cut />
              <span>{kind}</span>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .tag-lab { display: grid; }
        .tag-lab-wait { padding: 48px var(--scene-gutter); }
        .tag-lab-band { display: grid; gap: 24px; justify-items: center; padding: 56px var(--scene-gutter); }
        .tag-lab-band h1, .tag-lab-band h2 { font-size: 1rem; font-weight: 600; justify-self: start; }
        .tag-lab-night { background: var(--night); color: var(--night-ink); }
        .tag-lab-sky { background: var(--sky); color: var(--sky-ink); }
        .tag-lab-ground { background: var(--ground); color: var(--ground-ink); }
        .tag-lab-row { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; }
        .tag-lab-cast { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px 32px; width: 100%; }
        .tag-lab-cast li { display: flex; align-items: center; gap: 12px; }
        .tag-lab-cast span { font-family: var(--font-machine); font-size: 12px; opacity: 0.7; }
      `}</style>
    </div>
  );
}
