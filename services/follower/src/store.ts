import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Report } from "@atto/shared";
export interface HistoryEvent {
  id: string;
  token_id: string;
  kind: string;
  from_owner: string | null;
  to_owner: string | null;
  block_height: number;
  block_time: string;
  tx_hash: string | null;
  details: Record<string, unknown>;
}
export class HistoryStore {
  db: DatabaseSync;
  constructor(path = process.env.ATTO_DB_PATH ?? "./workbench/atto.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,token_id TEXT NOT NULL,kind TEXT NOT NULL,from_owner TEXT,to_owner TEXT,block_height INTEGER NOT NULL,block_time TEXT NOT NULL,tx_hash TEXT,details_json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS event_name_time ON events(token_id,block_time); CREATE TABLE IF NOT EXISTS reports(fingerprint TEXT PRIMARY KEY,token_id TEXT NOT NULL,built_at TEXT NOT NULL,report_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS names(token_id TEXT PRIMARY KEY,tla_id TEXT,current_owner TEXT,lease_end TEXT,updated_at TEXT); CREATE TABLE IF NOT EXISTS coverage(token_id TEXT PRIMARY KEY,since TEXT NOT NULL,through TEXT NOT NULL,complete INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS cursors(source TEXT PRIMARY KEY,height INTEGER NOT NULL);`,
    );
  }
  append(event: HistoryEvent) {
    this.db
      .prepare("INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        event.id,
        event.token_id,
        event.kind,
        event.from_owner,
        event.to_owner,
        event.block_height,
        event.block_time,
        event.tx_hash,
        JSON.stringify(event.details),
      );
  }
  saveReport(report: Report) {
    this.snapshots();
    this.db
      .prepare("INSERT OR IGNORE INTO report_snapshots(fingerprint,token_id,built_at,report_json) VALUES(?,?,?,?)")
      .run(report.fingerprint, report.name, report.built_at, JSON.stringify(report));
  }
  private snapshots() {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS report_snapshots(id INTEGER PRIMARY KEY,fingerprint TEXT NOT NULL,token_id TEXT NOT NULL,built_at TEXT NOT NULL,report_json TEXT NOT NULL,UNIQUE(fingerprint,built_at));",
    );
  }
  reports(name: string) {
    this.snapshots();
    return this.db
      .prepare(
        "SELECT report_json,built_at FROM report_snapshots WHERE token_id=? UNION SELECT report_json,built_at FROM reports WHERE token_id=? ORDER BY built_at DESC LIMIT 100",
      )
      .all(name, name)
      .map((r) => JSON.parse(r.report_json as string) as Report);
  }
  history(name: string, limit = 100, before?: string, beforeId = ""): HistoryEvent[] {
    return this.db
      .prepare(
        "SELECT * FROM events WHERE token_id=? AND (block_time < ? OR (block_time = ? AND id < ?)) ORDER BY block_time DESC,id DESC LIMIT ?",
      )
      .all(name, before ?? "9999", before ?? "9999", beforeId, limit)
      .map((r) => ({ ...r, details: JSON.parse(r.details_json as string) }) as unknown as HistoryEvent);
  }
  coverage(name: string) {
    return this.db.prepare("SELECT since,through,complete FROM coverage WHERE token_id=?").get(name) as
      { since: string; through: string; complete: number } | undefined;
  }
  setCoverage(name: string, since: string, through: string, complete: boolean) {
    this.db.prepare("INSERT OR REPLACE INTO coverage VALUES(?,?,?,?)").run(name, since, through, Number(complete));
  }
  changed(name: string, days: number, now = Date.now()) {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("days must be an integer from 1 to 365.");
    const since = new Date(now - days * 86400000).toISOString();
    const row = this.db
      .prepare(
        "SELECT * FROM events WHERE token_id=? AND block_time>=? AND kind IN ('transferred','sold_clean','reclaimed','re_rented','burned','minted') ORDER BY block_time DESC LIMIT 1",
      )
      .get(name, since);
    if (row)
      return {
        changed: true,
        at: row.block_time,
        kind: row.kind,
        previous_owner: row.from_owner,
        coverage: "observed_change",
        network: JSON.parse(row.details_json as string).network ?? "unspecified",
      };
    const coverage = this.coverage(name);
    const complete =
      coverage?.complete === 1 && coverage.since <= since && new Date(coverage.through).getTime() >= now - 60000;
    return complete
      ? { changed: false, coverage: "complete", through: coverage.through }
      : {
          changed: null,
          coverage: "unavailable",
          reason:
            "The history store does not cover this entire time window. Confirm the recipient through another trusted channel.",
        };
  }
  cursor(source: string) {
    return (
      (this.db.prepare("SELECT height FROM cursors WHERE source=?").get(source)?.height as number | undefined) ?? null
    );
  }
  setCursor(source: string, height: number) {
    this.db.prepare("INSERT OR REPLACE INTO cursors VALUES(?,?)").run(source, height);
  }
  close() {
    this.db.close();
  }
}
