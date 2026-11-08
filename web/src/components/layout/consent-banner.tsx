"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
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
          Only your settings are stored. No tracking. <Link href="/legal/cookies">Cookie policy</Link>
        </p>
        <button type="button" className="button" onClick={acknowledge}>
          Got it
        </button>
      </div>
    </div>
  );
}
