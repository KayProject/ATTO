"use client";
import Link from "next/link";
import { useAlertOnce } from "@/components/ui/alert-modal";

export function AsyncState({ error, message }: { error?: string | null; message: string }) {
  useAlertOnce(error ? `async:${error}` : null, () => ({ tone: "bad", title: "That didn't load", body: error }));
  return (
    <div className="frame stack" role="status">
      <p className="soft">{error ? message : message}</p>
      {error ? (
        <Link className="empty-link" href="/search">
          Inspect another name
        </Link>
      ) : null}
    </div>
  );
}
