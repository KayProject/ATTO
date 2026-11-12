"use client";

import Link from "next/link";
import { Screen } from "@/components/product/screen";
import { useLoad, usePersona } from "@/components/providers";
import { KEEPER_EXAMPLE, KEEPER_NETWORK, NETWORK, WALLET } from "@/lib/atto/backend";
import { atto } from "@/lib/atto/client";
import { formatDate } from "@/lib/atto/format";

export function MyNamesView() {
  const { ownerAccount: account } = usePersona();
  const { data, error, loading } = useLoad(() => (atto.keeperNames ? atto.keeperNames() : atto.ownedBy()), []);
  const elsewhere = WALLET && KEEPER_NETWORK !== NETWORK;

  return (
    <Screen>
      <div className="stack">
        <h1 className="screen-title">
          Your names.
          <br />
          In your hands.
        </h1>
        {elsewhere ? (
          <p className="notice">
            Keeper runs on NEAR {KEEPER_NETWORK} for now, so this page shows {KEEPER_NETWORK} names. Connect a{" "}
            {KEEPER_NETWORK} wallet from the wallet bar to manage yours.
          </p>
        ) : null}
        {account ? <p>Names owned by {account}.</p> : null}
      </div>
      {loading ? <p className="soft">Loading names…</p> : null}
      {error ? <p className="notice notice-bad">{error}</p> : null}
      {data && data.length === 0 ? (
        <p>
          {WALLET
            ? account
              ? "This wallet owns no names here. "
              : "No wallet is connected. "
            : "This account owns no names. Switch the acting account in Demo controls, or "}
          {WALLET ? null : (
            <Link className="empty-link" href="/search">
              inspect a public name
            </Link>
          )}
          {WALLET ? null : "."}
        </p>
      ) : null}
      {data && data.length > 0 ? (
        <ul className="ledger">
          {data.map((o) => (
            <li key={o.name}>
              <span className="ledger-name">{o.name}</span>
              <span className="soft">Lease ends {formatDate(o.lease_end)}</span>
              <Link className="button" href={`/owner/${o.name}`}>
                Open owner page
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {KEEPER_EXAMPLE ? (
        <section className="stack">
          <h2>See Keeper at work</h2>
          <p>
            {KEEPER_EXAMPLE} has a live reserve with Keeper switched on. Anyone can open its page and read the reserve,
            the next renewal and the share of income it sets aside.
          </p>
          <div className="row">
            <Link className="button button-primary" href={`/owner/${KEEPER_EXAMPLE}`}>
              Open the live example
            </Link>
          </div>
        </section>
      ) : null}
    </Screen>
  );
}
