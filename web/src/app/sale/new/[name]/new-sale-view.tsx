"use client";

import { useRouter } from "next/navigation";
import { use, useState, type FormEvent } from "react";
import { useAction, useLoad, usePersona } from "@/components/providers";
import { Plat, platLinks, ReportSections, Tally } from "@/components/report";
import { atto } from "@/lib/atto/client";
import { parseNear } from "@/lib/atto/format";

export function NewSaleView({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent(use(params).name);
  const router = useRouter();
  const { account } = usePersona();
  const { data: report, error: loadError, loading } = useLoad(() => atto.getReport(name), [name]);
  const { run, busy, error } = useAction();
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const yocto = parseNear(price);
    if (!yocto) {
      setPriceError("Enter a price above 0, such as 100 or 12.5.");
      return;
    }
    setPriceError(null);
    const id = await run(() => atto.list(name, yocto));
    if (id) router.push(`/sale/${id}`);
  }

  if (loading) return <p className="frame soft">Loading the report…</p>;
  if (loadError) return <p className="frame notice notice-bad">{loadError}</p>;
  if (!report) return <p className="frame">{name} isn&apos;t in the mock data.</p>;

  return (
    <div className="frame stack-lg">
      <div className="stack">
        <h1>List {name}</h1>
        <p>Listing as {account}. You keep the name until a buyer has paid and you hand it over.</p>
        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="price">Price in NEAR</label>
            <input
              id="price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={Boolean(priceError)}
              aria-describedby={priceError ? "price-error" : undefined}
            />
            {priceError ? (
              <p id="price-error" className="ask-seller small">
                {priceError}
              </p>
            ) : null}
          </div>
          <p className="small soft">Listing takes a 0.05 NEAR deposit, returned when the listing ends.</p>
          {error ? <p className="notice notice-bad">{error}</p> : null}
          <button type="submit" className="button button-primary" disabled={busy}>
            List this name
          </button>
        </form>
      </div>

      <section className="stack">
        <h2>What the buyer will see</h2>
        <Tally report={report} />
        <Plat name={report.name} links={platLinks(report)} />
        <ReportSections report={report} />
      </section>
    </div>
  );
}
