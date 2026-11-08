"use client";

import Link from "next/link";
import { SaleActions } from "@/components/sale/sale-actions";
import { reportAcceptanceKey, hasAcceptedReport } from "@/components/sale/report-acceptance";
import { use, useState } from "react";
import { TERMINAL_STATES, type Report } from "@atto/shared";
import { useAction, useLoad, usePersona } from "@/components/providers";
import { Plat, platLinks, platUnread, ReportProvenance, ReportSections, Tally } from "@/components/report";
import { atto } from "@/lib/atto/client";
import { formatNear, formatNsDateTime } from "@/lib/atto/format";
import { SaleProgress } from "@/components/sale/sale-progress";

function newItems(accepted: Report, final: Report) {
  const had = new Set([
    ...accepted.manifest.intents_keys,
    ...accepted.manifest.needs_seller,
    ...accepted.manifest.nfts.map((n) => `${n.contract_id} #${n.token_id}`),
  ]);
  return [
    ...final.manifest.intents_keys
      .map((k) => `New Intents key ${k}`)
      .filter((_, i) => !had.has(final.manifest.intents_keys[i]!)),
    ...final.manifest.needs_seller.filter((s) => !had.has(s)),
    ...final.manifest.nfts.map((n) => `${n.contract_id} #${n.token_id}`).filter((n) => !had.has(n)),
  ];
}

export function SaleRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account } = usePersona();
  const { data: sale, error: loadError, loading } = useLoad(() => atto.getSale(id), [id], 1000);
  const { run, busy, error } = useAction();
  const [acceptedReport, setAcceptedReport] = useState<string | null>(null);
  const [handoverNote, setHandoverNote] = useState<string | null>(null);

  if (loading) return <p className="frame soft">Loading the sale…</p>;
  if (loadError) return <p className="frame notice notice-bad">{loadError}</p>;
  if (!sale) {
    return (
      <div className="frame stack">
        <h1>There&apos;s no sale {id}</h1>
        <p>
          The mock forgets its sales when it restarts. <Link href="/sale">See current sales</Link>
        </p>
      </div>
    );
  }

  const { listing, can } = sale;
  const acceptanceKey = reportAcceptanceKey(id, account, sale.report.fingerprint);
  const accepted = hasAcceptedReport(acceptedReport, id, account, sale.report.fingerprint);
  const shown = sale.final_report ?? sale.report;
  const isBuyer = listing.buyer === account;
  const isSeller = listing.seller === account;
  const price = `${formatNear(listing.price)} NEAR`;
  const working = listing.state === "NameHeld" || listing.state === "Clearing" || listing.state === "Verified";
  const ended = TERMINAL_STATES.includes(listing.state);

  return (
    <div className="frame stack-lg">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/sale">Sales</Link>
        <span>/</span>
        <Link href={`/names/${sale.listing.token_id}`}>Public report</Link>
      </nav>
      <div className="stack">
        <h1 className="deed-title">{listing.token_id}</h1>
        <p className="lead">
          {price}, sold by {listing.seller}
          {listing.buyer ? ` to ${listing.buyer}` : ""}.
        </p>
        <SaleProgress sale={sale} />
      </div>

      <section className="report-head">
        <SaleActions state={listing.state}>
          {error ? <p className="notice notice-bad">{error}</p> : null}
          {handoverNote ? <p className="notice notice-bad">{handoverNote}</p> : null}

          {listing.state === "Listed" && isSeller ? (
            <>
              <h2>Waiting for a buyer</h2>
              <p>You keep the name and can delist any time before someone pays.</p>
              <p className="small soft">To continue the demo, switch to the buyer in the bar above.</p>
              <button type="button" className="button" disabled={busy} onClick={() => void run(() => atto.delist(id))}>
                Delist this name
              </button>
            </>
          ) : null}

          {listing.state === "Listed" && can.pay ? (
            <>
              <h2>Read the report, then pay</h2>
              <p>
                Your {price} goes to the escrow, not the seller. You can cancel for a full refund until the seller hands
                over the name.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAcceptedReport(e.target.checked ? acceptanceKey : null)}
                />
                <span>I&apos;ve read this report and accept what it says will stay with the name.</span>
              </label>
              <button
                type="button"
                className="button button-primary"
                disabled={!accepted || busy}
                onClick={() => void run(() => atto.pay(id, sale.report.fingerprint))}
              >
                Pay {price} into escrow
              </button>
            </>
          ) : null}

          {listing.state === "Paid" ? (
            <>
              <h2>{isSeller ? "The buyer has paid" : "Your payment is in escrow"}</h2>
              {can.hand_over ? (
                <>
                  <p>
                    Hand over the name to continue. You get {price} when the sale completes. The name&apos;s NEAR comes
                    to you at handover, and from then on you can&apos;t change anything about the name.
                  </p>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await atto.handOver(id);
                        setHandoverNote(result.accepted ? null : (result.reason ?? "The name went back to you."));
                      })
                    }
                  >
                    Hand over {listing.token_id}
                  </button>
                </>
              ) : (
                <p>
                  Waiting for {listing.seller} to hand over the name.
                  {sale.reclaim_at
                    ? ` If it hasn't arrived by ${formatNsDateTime(sale.reclaim_at)}, the payment can be reclaimed.`
                    : ""}
                </p>
              )}
              <div className="row">
                {can.cancel ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => void run(() => atto.cancel(id))}
                  >
                    Cancel and refund me
                  </button>
                ) : null}
                {can.reclaim ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => void run(() => atto.reclaimPayment(id))}
                  >
                    Refund the buyer
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {sale.awaiting_buyer && sale.final_report ? (
            <>
              <h2>The report changed</h2>
              <p>The final report isn&apos;t the one {isBuyer ? "you" : "the buyer"} accepted. It adds:</p>
              <ul>
                {newItems(sale.report, sale.final_report).map((item) => (
                  <li key={item} className="machine">
                    {item}
                  </li>
                ))}
              </ul>
              {can.accept_changed ? (
                <>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => void run(() => atto.acceptChangedReport(id))}
                  >
                    Accept the new report
                  </button>
                  <p className="small">
                    If you don&apos;t accept, do nothing. From{" "}
                    {sale.reverse_at ? formatNsDateTime(sale.reverse_at) : "24 hours after the handover"} anyone can
                    reverse the sale: the name goes back to the seller and your full payment comes back to you. It
                    can&apos;t be refunded sooner.
                  </p>
                </>
              ) : (
                <p>
                  Waiting for the buyer to accept it. If they don&apos;t, the sale can be reversed 24 hours after the
                  handover.
                </p>
              )}
            </>
          ) : null}

          {working && !sale.awaiting_buyer && listing.failure === null ? (
            <>
              <h2>The escrow is working</h2>
              <p>
                It owns the name now, so the seller is locked out. It cuts each leftover, then checks on the blockchain
                that they&apos;re gone.
              </p>
            </>
          ) : null}

          {working && listing.failure !== null ? (
            <>
              <h2>A check failed</h2>
              <p className="notice notice-bad">{listing.failure}</p>
            </>
          ) : null}

          {can.reverse ? (
            <button type="button" className="button" disabled={busy} onClick={() => void run(() => atto.reverse(id))}>
              Reverse the sale
            </button>
          ) : null}

          {listing.state === "Completed" ? (
            <>
              <h2>Sale completed</h2>
              <p className="notice notice-done">
                {listing.buyer} owns {listing.token_id}. {listing.seller} received {price}.
              </p>
              <div className="row">
                <Link className="button" href={`/names/${listing.token_id}`}>
                  See the new report
                </Link>
                <Link className="button" href={`/names/${listing.token_id}/history`}>
                  See history
                </Link>
              </div>
            </>
          ) : null}

          {listing.state === "Reversed" ? (
            <>
              <h2>Sale reversed</h2>
              <p className="notice notice-bad">
                What blocked it: {listing.failure}. The name is back with {listing.seller}, and {listing.buyer} has
                their {price} back.
              </p>
              <Link className="button" href={`/names/${listing.token_id}/history`}>
                See history
              </Link>
            </>
          ) : null}

          {listing.state === "Cancelled" ? (
            <>
              <h2>Sale cancelled</h2>
              <p>
                {listing.buyer ? `${listing.buyer} has their ${price} back. ` : ""}
                {listing.seller} still owns the name.
              </p>
            </>
          ) : null}

          {!ended && !isBuyer && !isSeller && !can.pay ? (
            <p className="small soft">You aren&apos;t part of this sale, so you can only watch it.</p>
          ) : null}
        </SaleActions>
        <Plat name={listing.token_id} links={platLinks(shown, listing.cleared_upto)} unread={platUnread(shown)} />
      </section>

      <section className="stack">
        <h2>{sale.awaiting_buyer ? "New report" : shown.final ? "Final report" : "Report"}</h2>
        <Tally report={shown} />
        <ReportProvenance report={shown} />
        {listing.state === "Completed" ? (
          <p className="small soft">
            This shows the name just before the escrow cleared it.{" "}
            <Link href={`/names/${listing.token_id}`}>See it as it is now</Link>
          </p>
        ) : null}
        <ReportSections report={shown} />
      </section>
    </div>
  );
}
