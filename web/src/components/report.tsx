"use client";

import { CheckCircle, Scissors, Warning } from "@phosphor-icons/react";
import { RATING_LABEL, SECTION_KEYS, type Rating, type Report, type ReportLine } from "@atto/shared";
import { formatDateTime, shortHash } from "@/lib/atto/format";

const ICONS = { Clean: CheckCircle, WillBeCleared: Scissors, NeedsSeller: Warning };

export function Stamp({ rating }: { rating: Rating }) {
  const Icon = ICONS[rating];
  return (
    <span className={`stamp stamp-${rating}`}>
      <Icon size={14} weight="bold" aria-hidden />
      {RATING_LABEL[rating]}
    </span>
  );
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

function Line({ line }: { line: ReportLine }) {
  const isKey = line.label.startsWith("ed25519:") || line.label.startsWith("nep141:");
  return (
    <div className="report-line">
      <div className="report-line-text">
        <p className={`report-line-label ${isKey ? "machine" : ""}`}>{line.label}</p>
        <p className="soft">{TIMESTAMP.test(line.detail) ? formatDateTime(line.detail) : line.detail}</p>
        {line.ask_seller ? <p className="ask-seller small">{line.ask_seller}</p> : null}
      </div>
      <Stamp rating={line.rating} />
    </div>
  );
}

export function Tally({ report }: { report: Report }) {
  return (
    <div className="tally">
      {(["Clean", "WillBeCleared", "NeedsSeller"] as Rating[]).map((r) => (
        <span key={r} className="row">
          <Stamp rating={r} />
          <span aria-label={`${report.counts[r]} lines`}>{report.counts[r]}</span>
        </span>
      ))}
    </div>
  );
}

export function ReportSections({ report }: { report: Report }) {
  return (
    <div className="section-list">
      {SECTION_KEYS.map((key) => {
        const section = report.sections[key];
        return (
          <section className="report-section" key={key} aria-label={section.title}>
            <h3>{section.title}</h3>
            <div>
              {section.status === "none_found" ? <p className="soft">None found</p> : null}
              {section.status === "unavailable" ? <p className="ask-seller">Unavailable right now.</p> : null}
              {section.lines.map((line) => (
                <Line key={line.label} line={line} />
              ))}
              {section.note ? <p className="small soft">{section.note}</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ReportProvenance({ report }: { report: Report }) {
  return (
    <p className="small soft">
      Built {formatDateTime(report.built_at)} from {report.sources.join(", ").replace(/\.$/, "")}. Report fingerprint{" "}
      <code title={report.fingerprint}>{shortHash(report.fingerprint)}</code>
      {report.final ? ". Final report, built after the seller lost control of the name." : "."}
    </p>
  );
}

export interface PlatLink {
  id: string;
  label: string;
  rating: Rating;
  cut: boolean;
}

const LINK_SECTIONS = ["intents_keys", "nfts", "intents_mode", "dao_roles", "sub_accounts"] as const;

function shorten(label: string) {
  return label.startsWith("ed25519:") ? `Intents key ${label.slice(8, 14)}…` : label;
}

/** A line's place in the escrow's clearing order: Intents keys first, then NFTs. -1 if the escrow doesn't clear it. */
function clearingIndex(report: Report, key: (typeof LINK_SECTIONS)[number], line: ReportLine): number {
  const { intents_keys, nfts } = report.manifest;
  if (key === "intents_keys") return intents_keys.indexOf(line.label);
  if (key !== "nfts") return -1;
  const label = line.data?.manifest_index;
  if (typeof label === "number") return label;
  const index = nfts.findIndex((nft) => `${nft.contract_id}/${nft.token_id}` === line.label);
  return index < 0 ? -1 : intents_keys.length + index;
}

/** Everything in the report still tied to the name. Items before `clearedUpto` have been cut. */
export function platLinks(report: Report, clearedUpto = 0): PlatLink[] {
  const links: PlatLink[] = [];
  for (const key of LINK_SECTIONS) {
    for (const line of report.sections[key].lines) {
      if (line.rating === "Clean") continue;
      const index = clearingIndex(report, key, line);
      links.push({
        id: `${key}:${line.label}`,
        label: shorten(line.label),
        rating: line.rating,
        cut: index >= 0 && index < clearedUpto,
      });
    }
  }
  return links;
}

/** True if a section behind the drawing couldn't be read, so an empty drawing doesn't mean the name is free. */
export function platUnread(report: Report): boolean {
  return LINK_SECTIONS.some((key) => report.sections[key].status === "unavailable");
}

const UNREAD = "ATTO couldn't read everything tied to this name.";
const ROW = 52;
const LINE_COLOUR: Record<Rating, string> = {
  Clean: "var(--clean)",
  WillBeCleared: "var(--cleared)",
  NeedsSeller: "var(--seller)",
};

/** The name as a parcel, with a line to everything it's tied to. Lines visibly break when cut. */
export function Plat({ name, links, unread = false }: { name: string; links: PlatLink[]; unread?: boolean }) {
  const rows = Math.max(links.length + (unread ? 1 : 0), 1);
  const height = rows * ROW;
  return (
    <figure className="plat" style={{ "--plat-row": `${ROW}px` } as React.CSSProperties}>
      <div className="plat-parcel">
        {name.split(".").map((part, i) => (
          <span key={i}>
            {i > 0 ? "." : ""}
            <wbr />
            {part}
          </span>
        ))}
      </div>
      <svg
        className="plat-lines"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        aria-hidden
      >
        {links.map((link, i) => {
          const y = i * ROW + ROW / 2;
          return (
            <path
              key={link.id}
              className="plat-line"
              d={`M0 ${height / 2} C 50 ${height / 2}, 50 ${y}, 100 ${y}`}
              pathLength={100}
              stroke={link.cut ? "var(--rule-strong)" : LINE_COLOUR[link.rating]}
              strokeDasharray={link.cut ? "30 40 30" : "50 0 50"}
            />
          );
        })}
        {links.length === 0 && !unread ? (
          <path className="plat-line" d={`M0 ${height / 2} L 40 ${height / 2}`} stroke="var(--clean)" />
        ) : null}
      </svg>
      {links.length === 0 ? (
        <figcaption className={unread ? "plat-unread" : "plat-free"}>
          {unread ? UNREAD : "ATTO found nothing else tied to this name."}
        </figcaption>
      ) : (
        <ul className="plat-items">
          {links.map((link) => (
            <li key={link.id} className="plat-item" data-cut={link.cut}>
              <span className="plat-item-label" title={link.label}>
                {link.label}
              </span>
              <span className="plat-item-state" style={{ color: link.cut ? undefined : LINE_COLOUR[link.rating] }}>
                {link.cut ? "Cut by the escrow" : RATING_LABEL[link.rating]}
              </span>
            </li>
          ))}
          {unread ? <li className="plat-item plat-unread">{UNREAD}</li> : null}
        </ul>
      )}
    </figure>
  );
}
