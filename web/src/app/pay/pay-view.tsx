"use client";

import { Screen } from "@/components/product/screen";
import { useState, type FormEvent } from "react";
import { KIND_LABEL } from "@/lib/atto/check";
import { atto } from "@/lib/atto/client";
import { formatDate } from "@/lib/atto/format";
import type { ChangedAnswer } from "@/lib/atto/types";
import { useAlert } from "@/components/ui/alert-modal";

const WINDOW_DAYS = 7;

/** The modal for one check: changed recently, steady, or no history. */
function result(name: string, answer: ChangedAnswer | null) {
  if (answer === null)
    return { tone: "info" as const, title: "No history yet", body: `ATTO has no history for ${name}, so it can't say whether it changed owner.` };
  if (answer.changed)
    return {
      tone: "warn" as const,
      title: `${name} changed owner recently`,
      body: `${KIND_LABEL[answer.kind!]} on ${formatDate(answer.at!)}${answer.previous_owner ? `, previously ${answer.previous_owner}` : ""}. Make sure you still mean to pay this name.`,
      actions: [
        { label: "See its history", href: `/names/${name}/history` },
        { label: "Got it", primary: true },
      ],
    };
  return { tone: "done" as const, title: "Same owner", body: `${name} hasn't changed owner in the last ${WINDOW_DAYS} days.` };
}

export function PayView() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { alert } = useAlert();

  async function check(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    try {
      const answer = await atto.changedOwner(clean, WINDOW_DAYS);
      void alert(result(clean, answer));
    } catch (e) {
      void alert({ tone: "bad", title: "The check failed", body: e instanceof Error ? e.message : "The check failed." });
    } finally {
      setBusy(false);
    }
  }

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

    </Screen>
  );
}
