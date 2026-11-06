"use client";

import Link from "next/link";
import { useLoad, usePersona } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { formatDate } from "@/lib/atto/format";

export function MyNamesView() {
  const { account } = usePersona();
  const { data, error, loading } = useLoad(() => atto.ownedBy(), []);

  return (
    <div className="frame stack-lg">
      <div className="stack">
        <h1>My names</h1>
        <p>Names owned by {account}.</p>
      </div>
      {loading ? <p className="soft">Loading names…</p> : null}
      {error ? <p className="notice notice-bad">{error}</p> : null}
      {data && data.length === 0 ? (
        <p>This account owns no names. Switch to the owner in the bar above to see some.</p>
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
    </div>
  );
}
