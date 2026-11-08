import Link from "next/link";
import type { ReactNode } from "react";
export function Screen({
  children,
  back = "/search",
  label = "Inspect a name",
}: {
  children: ReactNode;
  back?: string;
  label?: string;
}) {
  return (
    <div className="frame stack-lg">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href={back}>{label}</Link>
      </nav>
      {children}
    </div>
  );
}
