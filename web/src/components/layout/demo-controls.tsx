"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { mockTools } from "@/lib/atto/client";
import { BACKEND, LIVE_REPORTS } from "@/lib/atto/backend";
import { formatDateTime } from "@/lib/atto/format";
import { PERSONAS, type PersonaKey } from "@/lib/atto/mock/seeds";
import { usePersona } from "../providers";

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export function MockBar() {
  const { persona, account, accounts, setPersona, refresh } = usePersona();
  const router = useRouter();
  const [clock, setClock] = useState<string | null>(null);
  // Saved personas can arrive before this Suspense boundary hydrates.
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);

  async function advance(hours: number) {
    setClock(await mockTools.advanceClock(hours));
    refresh();
  }
  async function reset() {
    await mockTools.reset();
    setClock(null);
    refresh();
    router.push("/");
  }

  return (
    <aside className="mockbar" aria-label="Demo controls">
      <div className="frame mockbar-inner">
        <span className="environment-label">
          {BACKEND === "sandbox" ? "Local sandbox" : LIVE_REPORTS ? "Mock sales, live reports" : "Mock data"}
          {hydrated ? <span className="acting-account"> · {account}</span> : null}
        </span>
        <details className="demo-tools">
          <summary>Demo controls</summary>
          <div className="row">
            <p className="small soft">
              {BACKEND === "sandbox"
                ? "Real contracts on a private test chain, signed with throwaway keys."
                : LIVE_REPORTS
                  ? "Sales and owner controls use mock data. Real names read NEAR mainnet. No real money or wallets."
                  : "No real names, money or wallets are involved."}
              {clock ? ` Mock time: ${formatDateTime(clock)}.` : ""}
            </p>
            {hydrated ? (
              <label>
                Acting as
                <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaKey)}>
                  {(Object.keys(PERSONAS) as PersonaKey[]).map((key) => (
                    <option key={key} value={key}>
                      {PERSONAS[key].label}: {accounts[key]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {BACKEND === "mock" && (
              <>
                <button type="button" onClick={() => void advance(24)}>
                  Skip 24 hours
                </button>
                <button type="button" onClick={() => void reset()}>
                  Reset mock
                </button>
              </>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
