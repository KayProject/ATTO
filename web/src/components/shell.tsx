"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mockTools } from "@/lib/atto/client";
import { BACKEND, LIVE_REPORTS } from "@/lib/atto/backend";
import { formatDateTime } from "@/lib/atto/format";
import { PERSONAS, type PersonaKey } from "@/lib/atto/mock/seeds";
import { usePersona } from "./providers";

export function MockBar() {
  const { persona, accounts, setPersona, refresh } = usePersona();
  const router = useRouter();
  const [clock, setClock] = useState<string | null>(null);
  const select = useRef<HTMLSelectElement>(null);

  // Hydration keeps the option the server rendered, which can't know this browser's saved persona.
  useEffect(() => {
    if (select.current) select.current.value = persona;
  }, [persona]);

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
        {BACKEND === "sandbox" ? (
          <p>
            <strong>Local sandbox.</strong> Real ATTO contracts on a private test chain, signed with throwaway keys.
          </p>
        ) : (
          <p>
            {LIVE_REPORTS ? (
              <>
                <strong>Mock sales, live reports.</strong> Sales and owner pages use mock data, with no real money or
                wallets. Searching a real rented name reads it from NEAR mainnet.
              </>
            ) : (
              <>
                <strong>Mock data.</strong> No real names, money or wallets are involved.
              </>
            )}
            {clock ? ` Mock time: ${formatDateTime(clock)}.` : ""}
          </p>
        )}
        <div className="row">
          <label>
            Acting as
            <select ref={select} value={persona} onChange={(e) => setPersona(e.target.value as PersonaKey)}>
              {(Object.keys(PERSONAS) as PersonaKey[]).map((key) => (
                <option key={key} value={key}>
                  {PERSONAS[key].label}: {accounts[key]}
                </option>
              ))}
            </select>
          </label>
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
      </div>
    </aside>
  );
}

const NAV = [
  { href: "/", label: "Title Search" },
  { href: "/sale", label: "Sales" },
  { href: "/owner", label: "My names" },
  { href: "/pay", label: "Pay a name" },
  { href: "/developers", label: "Developers" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="frame site-header-inner">
        <Link href="/" className="wordmark">
          ATTO
        </Link>
        <nav className="site-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={path === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="frame site-footer-inner">
        <p>Title search and escrow for NEAR names.</p>
        <nav aria-label="Legal">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/cookies">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}

const CONSENT_KEY = "atto-consent";
const consentListeners = new Set<() => void>();
let acknowledgedThisVisit = false;

function subscribeConsent(notify: () => void) {
  consentListeners.add(notify);
  return () => {
    consentListeners.delete(notify);
  };
}

function consentPending() {
  if (acknowledgedThisVisit) return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === null;
  } catch {
    return true;
  }
}

function acknowledge() {
  acknowledgedThisVisit = true;
  try {
    localStorage.setItem(CONSENT_KEY, "acknowledged");
  } catch {
    // The banner may come back next visit.
  }
  consentListeners.forEach((notify) => notify());
}

export function ConsentBanner() {
  const show = useSyncExternalStore(subscribeConsent, consentPending, () => false);
  if (!show) return null;

  return (
    <div className="consent" role="region" aria-label="Cookie notice">
      <div className="frame consent-inner">
        <p className="small">
          ATTO sets no tracking or advertising cookies. It only stores your settings in this browser.{" "}
          <Link href="/legal/cookies">Read the cookie policy</Link>
        </p>
        <button type="button" className="button" onClick={acknowledge}>
          Got it
        </button>
      </div>
    </div>
  );
}
