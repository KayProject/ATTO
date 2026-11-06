const YOCTO_DIGITS = 24;

/** Yocto as a readable NEAR amount, e.g. "2500000000000000000000000" -> "2.5". */
export function formatNear(yocto: string, maxDecimals = 4): string {
  const padded = BigInt(yocto).toString().padStart(YOCTO_DIGITS + 1, "0");
  const whole = padded.slice(0, -YOCTO_DIGITS);
  const fraction = padded.slice(-YOCTO_DIGITS).slice(0, maxDecimals).replace(/0+$/, "");
  const wholeText = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${wholeText}.${fraction}` : wholeText;
}

/** A typed NEAR amount as yocto, or null if it isn't a positive amount NEAR can represent. */
export function parseNear(text: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,24}))?$/.exec(text.trim());
  if (!match) return null;
  const yocto = BigInt(match[1] + (match[2] ?? "").padEnd(YOCTO_DIGITS, "0"));
  return yocto > 0n ? yocto.toString() : null;
}

/** Decimal-string nanoseconds (U64 on chain) as a JavaScript date. */
export function nsToDate(ns: string): Date {
  return new Date(Number(BigInt(ns) / 1_000_000n));
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatDate = (d: string | Date) => DATE.format(new Date(d));
export const formatDateTime = (d: string | Date) => DATE_TIME.format(new Date(d));
export const formatNsDateTime = (ns: string) => DATE_TIME.format(nsToDate(ns));

export function shortHash(hex: string): string {
  return hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-8)}` : hex;
}
