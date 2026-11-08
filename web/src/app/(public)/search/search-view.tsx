"use client";
import Link from "next/link";
import { NameSearch } from "@/components/product/name-search";
import { TicketPanel } from "@/components/product/ticket-panel";
import { useLoad } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { LIVE_REPORTS } from "@/lib/atto/backend";
export function SearchView() {
  const { data: samples, error } = useLoad(() => atto.sampleNames(), []);
  return (
    <div className="frame search-screen stack">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
      </nav>
      <h1>
        Look closer.
        <br />
        Then decide.
      </h1>
      <p className="lead">Read the connections before the name changes hands.</p>
      <TicketPanel>
        <NameSearch />
        {error ? <p role="alert">{error}</p> : null}
        {samples ? (
          <div className="stack" style={{ marginTop: "1.5rem" }}>
            <p className="small soft">Try a demo name</p>
            <div className="sample-links">
              {samples.map((name) => (
                <Link key={name} href={`/names/${encodeURIComponent(name)}`}>
                  {name}
                </Link>
              ))}
            </div>
            {LIVE_REPORTS ? (
              <p className="small soft">
                Or inspect a real rented name, such as <Link href="/names/near.pay">near.pay</Link>.
              </p>
            ) : null}
          </div>
        ) : null}
      </TicketPanel>
    </div>
  );
}
