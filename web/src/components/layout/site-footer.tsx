"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenIcon, CookieIcon, ScrollIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/logo";
import { FooterMark } from "./footer-mark";

const LINKS = [
  { href: "/legal/terms", label: "Terms and conditions", Icon: ScrollIcon },
  { href: "/legal/privacy", label: "Privacy policy", Icon: ShieldCheckIcon },
  { href: "/legal/cookies", label: "Cookie policy", Icon: CookieIcon },
  { href: "/developers", label: "Documentation", Icon: BookOpenIcon },
];

/** The landing page closes on the full wordmark. Every other page gets a small logo and four icon links. */
export function SiteFooter() {
  const landing = usePathname() === "/";
  return (
    <footer className="site-footer" data-compact={!landing}>
      <div className="frame site-footer-inner">
        {landing ? (
          <p>Where NEAR names change hands.</p>
        ) : (
          <Link href="/" className="site-footer-logo" aria-label="ATTO home">
            <Logo title="" aria-hidden="true" />
          </Link>
        )}
        <nav aria-label="Legal and documentation">
          {LINKS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-label={label} title={label} className="site-footer-icon">
              <Icon weight="fill" size={20} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
      {landing ? <FooterMark /> : null}
    </footer>
  );
}
