"use client";

import Link from "next/link";
import { AsyncState } from "@/components/product/async-state";
import { use } from "react";
import { SceneArt } from "@/components/product/scene-art";
import { useLoad } from "@/components/providers";
import { Plat, platLinks, platUnread, ReportProvenance, ReportSections, Tally } from "@/components/report";
import { LIVE_REPORTS, NETWORK } from "@/lib/atto/backend";
import { atto } from "@/lib/atto/client";
import { useAlertOnce } from "@/components/ui/alert-modal";
import type { Report } from "@atto/shared";

export function ReportView({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent(use(params).name);
  const { data, error, loading } = useLoad(async () => {
    const [report, owned, open, samples] = await Promise.all([
      atto.getReport(name),
      atto.ownedBy(),
      atto.openSales(),
      atto.sampleNames(),
    ]);
    return { report, owned, open, samples };
  }, [name]);

  const notes = data?.report ? reportNotes(data.report) : [];
  useAlertOnce(notes.length ? `report:${name}:${data!.report!.fingerprint}` : null, () => ({
    tone: notes.some((n) => n.bad) ? "warn" : "info",
    title: "Before you rely on this report",
    body: (
      <ul className="alert-list">
        {notes.map((n) => (
          <li key={n.text}>{n.text}</li>
        ))}
      </ul>
    ),
  }));
  if (loading) return <AsyncState message="Inspecting the name…" />;
  if (error || !data)
    return <AsyncState error={error} message="No report was returned. Try inspecting the name again." />;

  const { report, owned, open, samples } = data;
  if (!report) {
    return (
      <div className="frame stack">
        <h1>{name}</h1>
        <p>
          {NETWORK
            ? `ATTO found no rented name with this spelling on NEAR ${NETWORK}.`
            : LIVE_REPORTS
            ? "ATTO found no rented name with this spelling on NEAR mainnet, or in the demo."
            : "There's no report for this name in the demo."}
        </p>
        {samples.length > 0 ? (
          <p>
            Try one of the demo names:{" "}
            {samples.map((s, i) => (
              <span key={s}>
                {i > 0 ? ", " : ""}
                <Link href={`/names/${s}`}>{s}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    );
  }

  const mine = owned.find((o) => o.name === name);
  const sale = open.find((l) => l.token_id === name);
  const live = report.network === "mainnet";

  return (
    <div className="frame stack-lg">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/search">Inspect another name</Link>
      </nav>
      <section className="report-head">
        <div className="stack">
          <h1 className="deed-title">{report.name}</h1>
          <Tally report={report} />
          <ReportProvenance report={report} />
          <div className="row">
            {!sale && !(mine && !mine.listing_id && report.clean_sale.supported) ? (
              <a className="button button-primary" href="#report-details">
                Review the report
              </a>
            ) : null}
            {sale ? (
              <Link className="button button-primary" href={`/sale/${sale.id}`}>
                {mine ? "Open your listing" : "See this listing"}
              </Link>
            ) : null}
            {mine && !mine.listing_id && report.clean_sale.supported ? (
              <Link className="button button-primary" href={`/sale/new/${name}`}>
                List this name
              </Link>
            ) : null}
            {mine ? (
              <Link className="button" href={`/owner/${name}`}>
                Open owner page
              </Link>
            ) : null}
            {live ? null : (
              <Link className="button" href={`/names/${name}/history`}>
                See history
              </Link>
            )}
          </div>
        </div>
        <SceneArt scene="inspection" />
      </section>
      <section className="connection-ticket stack">
        <h2>Connections</h2>
        <Plat name={report.name} links={platLinks(report)} unread={platUnread(report)} />
      </section>
      <section id="report-details" className="stack">
        <h2>Report details</h2>
        <ReportSections report={report} />
      </section>
    </div>
  );
}

/** What a reader should know before relying on a report, shown once in a modal. */
function reportNotes(report: Report) {
  const live = report.network === "mainnet";
  const notes: { text: string; bad: boolean }[] = [];
  if (report.counts.NeedsSeller > 0)
    notes.push({ text: "Seller action needed. Review the open report sections before agreeing to a sale.", bad: true });
  if (Object.values(report.sections).some((section) => section.status === "unavailable"))
    notes.push({ text: "Some data is unavailable, so this report is incomplete.", bad: true });
  if (live)
    notes.push({
      text: "This is a live report of a real name on NEAR mainnet. It's read-only: ATTO's escrow isn't on mainnet yet, so this name can't be sold through ATTO.",
      bad: false,
    });
  if (!live && !report.clean_sale.supported)
    notes.push({ text: `Clean Sale isn't available for this name. ${report.clean_sale.reason ?? ""}`, bad: true });
  if (live && report.clean_sale.reason) notes.push({ text: `${report.clean_sale.reason} Reload in a minute to read them again.`, bad: true });
  return notes;
}
