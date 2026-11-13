"use client";
import { useAlertOnce } from "@/components/ui/alert-modal";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Listing } from "@atto/shared";
import { useLoad, usePersona } from "@/components/providers";
import { atto } from "@/lib/atto/client";
import { formatNear } from "@/lib/atto/format";
import { STATE_LABEL } from "./state-label";

function SaleRow({ listing }: { listing: Listing }) {
  return (
    <li>
      <span className="ledger-name">{listing.token_id}</span>
      <span className="soft">
        {formatNear(listing.price)} NEAR, {STATE_LABEL[listing.state]}
      </span>
      <Link className="button" href={`/sale/${listing.id}`}>
        Open sale
      </Link>
    </li>
  );
}

export function SalesView() {
  const { account } = usePersona();
  const { data, error, loading } = useLoad(async () => {
    const [open, mine, owned] = await Promise.all([atto.openSales(), atto.mySales(), atto.ownedBy()]);
    return { open, mine, owned };
  }, []);

  useAlertOnce(error ? `load:${error}` : null, () => ({ tone: "bad", title: "Sales didn't load", body: error }));
  if (loading) return <p className="frame soft">Loading sales…</p>;
  if (error || !data) return <p className="frame soft">Sales couldn&apos;t load.</p>;

  const toList = data.owned.filter((o) => !o.listing_id);

  return (
    <div className="frame stack-lg">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="screen-title">Find your next name.</h1>
        <Link className="button button-primary" href="/owner">
          Sell a name
        </Link>
      </div>
      <Tabs defaultValue="available">
        <TabsList aria-label="Sales views">
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="mine">Your sales</TabsTrigger>
          <TabsTrigger value="sell">Ready to list</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="stack">
          <h2>Names for sale</h2>
          {data.open.length ? (
            <ul className="ledger">
              {data.open.map((l) => (
                <SaleRow key={l.id} listing={l} />
              ))}
            </ul>
          ) : (
            <p>No names are listed right now. Switch to the seller in the bar above and list one.</p>
          )}
        </TabsContent>

        <TabsContent value="mine" className="stack">
          <h2>Your sales</h2>
          {data.mine.length ? (
            <ul className="ledger">
              {data.mine.map((l) => (
                <SaleRow key={l.id} listing={l} />
              ))}
            </ul>
          ) : (
            <p>{account} isn&apos;t part of any sale yet.</p>
          )}
        </TabsContent>

        <TabsContent value="sell" className="stack">
          <h2>Sell a name</h2>
          {toList.length ? (
            <ul className="ledger">
              {toList.map((o) => (
                <li key={o.name}>
                  <span className="ledger-name">{o.name}</span>
                  {o.clean_sale.supported ? (
                    <Link className="button" href={`/sale/new/${o.name}`}>
                      List this name
                    </Link>
                  ) : (
                    <span className="small soft">Clean Sale isn&apos;t available for this name.</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>{account} has no names to list.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
