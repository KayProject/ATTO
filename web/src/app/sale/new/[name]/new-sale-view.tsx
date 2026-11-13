"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, type FormEvent } from "react";
import { useAction, useLoad, usePersona } from "@/components/providers";
import { Plat, platLinks, platUnread, ReportSections, Tally } from "@/components/report";
import { atto } from "@/lib/atto/client";
import { useAlertOnce } from "@/components/ui/alert-modal";
import { parseNear } from "@/lib/atto/format";

export function NewSaleView({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent(use(params).name);
  const router = useRouter();
  const { account } = usePersona();
  const {
    data,
    error: loadError,
    loading,
  } = useLoad(async () => {
    const [report, owned] = await Promise.all([atto.getReport(name), atto.ownedBy()]);
    return { report, mine: owned.some((item) => item.name === name) };
  }, [name]);
  const report = data?.report;
  const { run, busy } = useAction();
  useAlertOnce(loadError ? `load:${loadError}` : null, () => ({ tone: "bad", title: "This report didn't load", body: loadError }));
  useAlertOnce(report && !report.clean_sale.supported ? `unsupported:${name}` : null, () => ({
    tone: "warn",
    title: "This name can't be listed yet",
    body: report!.clean_sale.reason,
  }));
  useAlertOnce(data && report && !data.mine ? `notmine:${name}:${account}` : null, () => ({
    tone: "info",
    title: "Not your name",
    body: `${account} doesn't own ${name}, so it can't list it.`,
  }));
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
  if (loadError) return <p className="frame soft">This report couldn&apos;t load.</p>;
  if (!report) return <p className="frame">{name} isn&apos;t in the mock data.</p>;

  return (
    <div className="frame stack-lg">
      <div className="stack">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href={`/names/${name}`}>Public report</Link>
          <span>/</span>
          <Link href="/sale">Sales</Link>
        </nav>
        <h1 className="screen-title">List {name}</h1>
        <p>Listing as {account}. You keep the name until a buyer has paid and you hand it over.</p>
        <form className="ticket-panel task-panel stack" onSubmit={submit} noValidate>
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
          <button
            type="submit"
            className="button button-primary"
            disabled={busy || !report.clean_sale.supported || !data?.mine || report.network === "mainnet"}
          >
            List this name
          </button>
        </form>
      </div>

      <section className="stack">
        <h2>What the buyer will see</h2>
        <Tally report={report} />
        <Plat name={report.name} links={platLinks(report)} unread={platUnread(report)} />
        <ReportSections report={report} />
      </section>
    </div>
  );
}
