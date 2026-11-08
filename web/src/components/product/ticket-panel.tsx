import type { ReactNode } from "react";
export function TicketPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`ticket-panel ${className}`}>{children}</section>;
}
