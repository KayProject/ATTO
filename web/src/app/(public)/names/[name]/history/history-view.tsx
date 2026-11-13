"use client";

import Link from "next/link";
import { use } from "react";
import { useLoad } from "@/components/providers";
import { useAlertOnce } from "@/components/ui/alert-modal";
import { Stamp } from "@/components/report";
import { atto } from "@/lib/atto/client";
import { KIND_LABEL } from "@/lib/atto/check";
import { formatDateTime, formatNear, shortHash } from "@/lib/atto/format";
import type { HistoryEvent, ReportSummary } from "@/lib/atto/types";

function ReportRow({ title, report }: { title: string; report: ReportSummary | null }) {
  if (!report) return <p className="small">{title}: not recorded.</p>;
  return (
    <div className="stack small">
      <p>
        {title}, built {formatDateTime(report.built_at)}, fingerprint{" "}
        <code title={report.fingerprint}>{shortHash(report.fingerprint)}</code>
      </p>
      <div className="row">
        <span className="row">
          <Stamp rating="Clean" /> {report.counts.Clean}
        </span>
        <span className="row">
          <Stamp rating="WillBeCleared" /> {report.counts.WillBeCleared}
        </span>
        <span className="row">
          <Stamp rating="NeedsSeller" /> {report.counts.NeedsSeller}
        </span>
      </div>
    </div>
  );
}

function Event({ event }: { event: HistoryEvent }) {
  const { sale } = event;
  const parties = [
    event.from_owner ? `from ${event.from_owner}` : null,
    event.to_owner ? `to ${event.to_owner}` : null,
  ].filter(Boolean);
  return (
    <li data-sale={Boolean(sale)}>
      <h3>{KIND_LABEL[event.kind]}</h3>
      <p className="small soft">
        {formatDateTime(event.block_time)}
        {parties.length ? `, ${parties.join(" ")}` : ""}
      </p>
      {event.tx_hash ? (
        <p className="small soft">
          Transaction <code title={event.tx_hash}>{shortHash(event.tx_hash)}</code>
        </p>
      ) : null}
      {event.note ? <p>{event.note}</p> : null}
      {sale ? (
        <div className="stack">
          <p>
            Sold for {formatNear(sale.price)} NEAR.{" "}
            <Link href={`/sale/${sale.listing_id}`}>Open sale {sale.listing_id}</Link>
          </p>
          <ReportRow title="Report the buyer accepted" report={sale.accepted_report} />
          <ReportRow title="Final report" report={sale.final_report} />
          <div className="small">
            <p>Cleared by the escrow:</p>
            {sale.keys_removed.length + sale.nfts_revoked.length === 0 ? (
              <p className="soft">Nothing needed clearing.</p>
            ) : null}
            <ul>
              {sale.keys_removed.map((k) => (
                <li key={k}>
                  Intents key <code>{k}</code>
                </li>
              ))}
              {sale.nfts_revoked.map((n) => (
                <li key={`${n.contract_id}:${n.token_id}`}>
                  Approvals on {n.contract_id} #{n.token_id}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function HistoryView({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent(use(params).name);
  const { data, error, loading } = useLoad(() => atto.getHistory(name), [name]);
  useAlertOnce(error ? `load:${error}` : null, () => ({ tone: "bad", title: "History didn't load", body: error }));

  return (
    <div className="frame stack-lg">
      <div className="stack">
        <h1 className="screen-title">History of {name}</h1>
        <p>
          <Link href={`/names/${name}`}>Back to the report</Link>
        </p>
      </div>
      {loading ? <p className="soft">Loading history…</p> : null}
      {data && data.length === 0 ? <p>There&apos;s no recorded history for this name.</p> : null}
      {data && data.length > 0 ? (
        <ol className="timeline">
          {data.map((event) => (
            <Event key={event.id} event={event} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
