"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLoad } from "@/components/providers";
import { Plat, platLinks, platUnread } from "@/components/report";
import { LIVE_REPORTS } from "@/lib/atto/backend";
import { atto } from "@/lib/atto/client";

export function HomeView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: samples } = useLoad(() => atto.sampleNames(), []);
  const { data: example } = useLoad(() => atto.getReport("bakery.food"), []);

  function search(event: FormEvent) {
    event.preventDefault();
    const name = query.trim().toLowerCase();
    if (name) router.push(`/names/${encodeURIComponent(name)}`);
  }

  return (
    <div className="frame stack-lg">
      <section className="hero">
        <div className="stack">
          <h1>See what a name is still tied to before you buy it.</h1>
          <p className="lead">
            A rented NEAR name is also a working account. It can keep connections its last owner set up. ATTO lists
            them, then cuts them during the sale.
          </p>
          <form className="search" role="search" onSubmit={search}>
            <input
              type="search"
              aria-label="Name to search"
              placeholder="bakery.food"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="button button-primary">
              Run Title Search
            </button>
          </form>
          {samples ? (
            <p className="small soft">
              Try{" "}
              {samples.map((name, i) => (
                <span key={name}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/names/${name}`}>{name}</Link>
                </span>
              ))}
              {LIVE_REPORTS ? (
                <>
                  {" "}
                  from the demo, or a real rented name such as <Link href="/names/near.pay">near.pay</Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {example ? <Plat name={example.name} links={platLinks(example)} unread={platUnread(example)} /> : null}
      </section>

      <section className="stack">
        <h2>How a Clean Sale runs</h2>
        <ol className="flow">
          <li>The seller lists the name, and ATTO attaches a Title Search.</li>
          <li>The buyer reads the report and pays into the escrow. The seller doesn&apos;t get the money yet.</li>
          <li>The seller hands the name to the escrow, and can no longer change anything.</li>
          <li>The escrow cuts the leftover Intents keys and NFT approvals, then checks its own work on the blockchain.</li>
          <li>The name goes to the buyer and the money to the seller. If a check fails, each gets back what they started with.</li>
        </ol>
      </section>

      <section className="stack">
        <h2>What a report can&apos;t fix</h2>
        <p>
          Sub-accounts and DAO roles can only be changed by whoever holds them. ATTO shows them to you and says what to
          ask the seller, so you decide before you pay.
        </p>
      </section>
    </div>
  );
}
