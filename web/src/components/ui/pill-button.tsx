// The site's one button shape: a pill with a round end cap holding an arrow, spinner or tick.
"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PillLook {
  tone?: "primary" | "secondary";
  state?: "idle" | "working" | "done";
  /** Gentle idle nudge of the arrow. Use on one button per screen. */
  beckon?: boolean;
}

export type PillButtonProps = PillLook & React.ButtonHTMLAttributes<HTMLButtonElement>;
export type PillLinkProps = PillLook & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

function pillClass({ tone = "primary", state = "idle", beckon = false }: PillLook, className?: string) {
  return cn("pill", `pill-${tone}`, beckon && state === "idle" && "pill-beckon", className);
}

function Cap({ state = "idle" }: { state?: PillLook["state"] }) {
  return (
    <span className="pill-cap" aria-hidden>
      {state === "working" ? (
        <CircleNotch weight="bold" className="pill-spin" />
      ) : state === "done" ? (
        <Check weight="bold" />
      ) : (
        <ArrowRight weight="bold" />
      )}
    </span>
  );
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ tone, state = "idle", beckon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={pillClass({ tone, state, beckon }, className)}
      data-state={state}
      aria-busy={state === "working" || undefined}
      {...props}
    >
      <span className="pill-label">{children}</span>
      <Cap state={state} />
    </button>
  ),
);
PillButton.displayName = "PillButton";

export function PillLink({ tone, state = "idle", beckon, className, children, href, ...props }: PillLinkProps) {
  return (
    <Link href={href} className={pillClass({ tone, state, beckon }, className)} data-state={state} {...props}>
      <span className="pill-label">{children}</span>
      <Cap state={state} />
    </Link>
  );
}
