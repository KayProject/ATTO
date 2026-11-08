export function reportAcceptanceKey(id: string, account: string, fingerprint: string) {
  return JSON.stringify([id, account, fingerprint]);
}
export function hasAcceptedReport(accepted: string | null, id: string, account: string, fingerprint: string) {
  return accepted === reportAcceptanceKey(id, account, fingerprint);
}
