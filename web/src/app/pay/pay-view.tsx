"use client";

import Link from "next/link";
import { Screen } from "@/components/product/screen";
import { useState, type FormEvent } from "react";
import { KIND_LABEL } from "@/lib/atto/check";
import { atto } from "@/lib/atto/client";
import { formatDate } from "@/lib/atto/format";
import type { ChangedAnswer } from "@/lib/atto/types";

const WINDOW_DAYS = 7;

type Outcome = { name: string; answer: ChangedAnswer | null };

export function PayView() {
  const [name, setName] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      setOutcome({ name: clean, answer: await atto.changedOwner(clean, WINDOW_DAYS) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }

  const answer = outcome?.answer;

  return (
    <Screen>
      <div className="stack">
        <h1 className="screen-title">Before you pay.</h1>
        <p>Check whether a name changed owner in the last seven days. This sends no money.</p>
      </div>
      <form className="ticket-panel task-panel stack" onSubmit={check}>
        <div className="field">
          <label htmlFor="pay-name">Name to pay</label>
          <input
            id="pay-name"
            type="text"
            placeholder="corner.cafe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="button button-primary" disabled={busy || !name.trim()}>
          Check this name
        </button>
      </form>

      <div aria-live="polite" className="stack">
        {error ? <p className="notice notice-bad">{error}</p> : null}
        {outcome && answer === null ? (
          <p className="notice">
            ATTO has no history for {outcome.name}, so it can&apos;t say whether it changed owner.
          </p>
        ) : null}
        {outcome && answer?.changed ? (
          <div className="notice notice-bad stack">
            <h2>{outcome.name} changed owner recently</h2>
            <p>
              {KIND_LABEL[answer.kind!]} on {formatDate(answer.at!)}
              {answer.previous_owner ? `, previously ${answer.previous_owner}` : ""}. Make sure you still mean to pay
              this name.
            </p>
            <p>
              <Link href={`/names/${outcome.name}/history`}>See its history</Link>
            </p>
          </div>
        ) : null}
        {outcome && answer && !answer.changed ? (
          <p className="notice notice-done">
            {outcome.name} hasn&apos;t changed owner in the last {WINDOW_DAYS} days.
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
