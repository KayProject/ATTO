import Link from "next/link";
export function AsyncState({ error, message }: { error?: string | null; message: string }) {
  return (
    <div className="frame stack" role={error ? "alert" : "status"}>
      <p className={error ? "notice notice-bad" : "soft"}>{error || message}</p>
      {error ? (
        <Link className="empty-link" href="/search">
          Inspect another name
        </Link>
      ) : null}
    </div>
  );
}
