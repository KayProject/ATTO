"use client";

import Link from "next/link";
import { AsyncState } from "@/components/product/async-state";
import { use } from "react";
import { SceneArt } from "@/components/product/scene-art";
import { useLoad } from "@/components/providers";
import { Plat, platLinks, platUnread, ReportProvenance, ReportSections, Tally } from "@/components/report";
import { LIVE_REPORTS } from "@/lib/atto/backend";
import { atto } from "@/lib/atto/client";

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

  if (loading) return <AsyncState message="Inspecting the name…" />;
  if (error || !data)
    return <AsyncState error={error} message="No report was returned. Try inspecting the name again." />;

  const { report, owned, open, samples } = data;
  if (!report) {
    return (
      <div className="frame stack">
        <h1>{name}</h1>
        <p>
          {LIVE_REPORTS
            ? "ATTO found no rented name with this spelling on NEAR mainnet, or in the demo."
            : "There's no report for this name in the demo."}
        </p>
        <p>
          Try one of the demo names:{" "}
          {samples.map((s, i) => (
            <span key={s}>
              {i > 0 ? ", " : ""}
              <Link href={`/names/${s}`}>{s}</Link>
            </span>
          ))}
        </p>
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
          {report.counts.NeedsSeller > 0 ? (
            <p className="notice notice-bad">
              Seller action needed. Review the open report sections before agreeing to a sale.
            </p>
          ) : null}
          {Object.values(report.sections).some((section) => section.status === "unavailable") ? (
            <p className="notice notice-bad">Some data is unavailable. This report is incomplete.</p>
          ) : null}
          <ReportProvenance report={report} />
          {live ? (
            <p className="notice">
              This is a live report of a real name on NEAR mainnet. It&apos;s read-only: ATTO&apos;s escrow isn&apos;t
              on mainnet yet, so this name can&apos;t be sold through ATTO.
            </p>
          ) : null}
          {!live && !report.clean_sale.supported ? (
            <p className="notice notice-bad">
              Clean Sale isn&apos;t available for this name. {report.clean_sale.reason}
            </p>
          ) : null}
          {live && report.clean_sale.reason ? (
            <p className="notice notice-bad">{report.clean_sale.reason} Reload in a minute to read them again.</p>
          ) : null}
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
