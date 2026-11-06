"use client";

import Link from "next/link";
import { use, useState, type FormEvent } from "react";
import { useAction, useLoad, usePersona } from "@/components/providers";
import { ReportProvenance, Tally } from "@/components/report";
import { atto } from "@/lib/atto/client";
import { formatDate, formatNear, parseNear } from "@/lib/atto/format";
import { NOT_OWNER } from "@/lib/atto/types";

function AmountForm({
  id,
  label,
  action,
  busy,
  onSubmit,
}: {
  id: string;
  label: string;
  action: string;
  busy: boolean;
  onSubmit: (yocto: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const yocto = parseNear(value);
    setInvalid(!yocto);
    if (!yocto) return;
    await onSubmit(yocto);
    setValue("");
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid} />
        {invalid ? <p className="ask-seller small">Enter an amount above 0, such as 5 or 2.5.</p> : null}
      </div>
      <button type="submit" className="button" disabled={busy}>
        {action}
      </button>
    </form>
  );
}

export function OwnerPageView({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent(use(params).name);
  const { account } = usePersona();
  const { data: view, error: loadError, loading } = useLoad(() => atto.getOwnerView(name), [name]);
  const { run, busy, error } = useAction();
  const [shareDraft, setShare] = useState<string | null>(null);
  const share = shareDraft ?? String((view?.reserve.share_bps ?? 0) / 100);

  if (loading) return <p className="frame soft">Checking who owns this name…</p>;
  if (loadError === NOT_OWNER) {
    return (
      <div className="frame stack">
        <h1>This page is for the owner of {name}</h1>
        <p className="notice notice-bad">
          {account} doesn&apos;t own this name, so this page stays closed. Anyone can still read its{" "}
          <Link href={`/names/${name}`}>public report</Link>.
        </p>
      </div>
    );
  }
  if (loadError || !view) {
    return (
      <div className="frame stack">
        <h1>The owner page for {name} can&apos;t open</h1>
        <p className="notice notice-bad">{loadError ?? "ATTO returned nothing for this name."}</p>
        <p>
          Anyone can still read its <Link href={`/names/${name}`}>public report</Link>.
        </p>
      </div>
    );
  }

  const { reserve } = view;
  const short = BigInt(view.shortfall) > 0n;
  const filled = Math.min(100, Number((BigInt(reserve.balance) * 100n) / BigInt(view.renewal_cost)));
  const shareBps = Math.round(Number(share) * 100);
  const shareValid = share.trim() !== "" && Number.isFinite(shareBps) && shareBps >= 0 && shareBps <= 10_000;

  return (
    <div className="frame stack-lg">
      <div className="stack">
        <h1 className="deed-title">{view.name}</h1>
        <p>Only {view.owner}, the current owner, can open this page.</p>
        <dl className="facts">
          <div>
            <dt>Lease ends</dt>
            <dd>{formatDate(view.lease_end)}</dd>
          </div>
          <div>
            <dt>Next renewal</dt>
            <dd>{formatNear(view.rent)} NEAR</dd>
          </div>
          <div>
            <dt>Keeper</dt>
            <dd>{reserve.enabled ? "On" : "Off"}</dd>
          </div>
          <div>
            <dt>Share of earnings</dt>
            <dd>{reserve.share_bps / 100}%</dd>
          </div>
        </dl>
      </div>

      {error ? <p className="notice notice-bad">{error}</p> : null}

      <section className="stack">
        <h2>Rent reserve</h2>
        <p className="lead">{formatNear(reserve.balance)} NEAR set aside</p>
        <div
          className="meter"
          data-short={short}
          role="img"
          aria-label={`The reserve holds ${filled}% of the next renewal's cost`}
        >
          <span style={{ width: `${filled}%` }} />
        </div>
        {short ? (
          <p className="notice notice-bad">
            The reserve is {formatNear(view.shortfall)} NEAR short of the next renewal, which is needed by {formatDate(view.lease_end)}.
            Top it up or the name could be lost.
          </p>
        ) : (
          <p className="soft">This covers the next renewal, which costs {formatNear(view.renewal_cost)} NEAR including a small margin the registry refunds.</p>
        )}
        <p className="small soft">The reserve belongs to the name. If you sell the name, it goes to the buyer.</p>
        {view.can_renew ? (
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void run(() => atto.renew(name))}>
            Renew now from the reserve
          </button>
        ) : (
          <p className="small soft">Renewal opens {formatDate(view.renew_window_opens)}, 30 days before the lease ends.</p>
        )}
      </section>

      <section className="report-head">
        <AmountForm id="top-up" label="Top up, in NEAR" action="Top up the reserve" busy={busy} onSubmit={(a) => run(() => atto.topUp(name, a))} />
        <AmountForm id="withdraw" label="Withdraw, in NEAR" action="Withdraw to the name" busy={busy} onSubmit={(a) => run(() => atto.withdraw(name, a))} />
      </section>

      <section className="stack">
        <h2>Keeper</h2>
        <p>
          Keeper can move a share of this name&apos;s new income into the reserve. The name&apos;s wallet caps that at {formatNear(view.grant_cap)} NEAR,
          one year&apos;s rent, and only lets it go to the reserve.
        </p>
        <div className="field">
          <label htmlFor="share">Share of new income, in %</label>
          <input id="share" type="text" inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} aria-invalid={!shareValid} />
          {!shareValid ? <p className="ask-seller small">Enter a share between 0 and 100.</p> : null}
        </div>
        <div className="row">
          <button
            type="button"
            className="button"
            disabled={busy || !shareValid}
            onClick={() => void run(() => atto.configureKeeper(name, reserve.enabled, shareBps))}
          >
            Save share
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !shareValid}
            onClick={() => void run(() => atto.configureKeeper(name, !reserve.enabled, shareBps))}
          >
            {reserve.enabled ? "Switch Keeper off" : "Switch Keeper on"}
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>Latest Title Search</h2>
        <Tally report={view.report} />
        <ReportProvenance report={view.report} />
        <div className="row">
          <Link className="button" href={`/names/${name}`}>
            Read the report
          </Link>
          <Link className="button" href={`/names/${name}/history`}>
            See history
          </Link>
        </div>
      </section>
    </div>
  );
}
