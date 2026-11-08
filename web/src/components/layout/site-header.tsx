"use client";

import Link from "next/link";
import { List } from "@phosphor-icons/react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "../ui/dialog";
import { usePathname } from "next/navigation";
import { Logo } from "../brand/logo";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/sale", label: "Sell" },
  { href: "/owner", label: "Keeper" },
  { href: "/pay", label: "Check" },
  { href: "/developers", label: "Developers" },
];
export function SiteHeader() {
  const path = usePathname();
  const active = (href: string) =>
    path === href || path.startsWith(`${href}/`) || (href === "/search" && path.startsWith("/names/"));
  return (
    <header className="site-header">
      <div className="frame site-header-inner">
        <Link href="/" className="wordmark" aria-label="ATTO home">
          <Logo title="" aria-hidden="true" />
        </Link>
        <nav className="site-nav" aria-label="Main">
          {NAV.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Dialog>
          <DialogTrigger asChild>
            <button className="menu-button" aria-label="Open navigation">
              <List size={22} weight="bold" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Explore ATTO</DialogTitle>
            <DialogDescription className="sr-only">ATTO navigation</DialogDescription>
            <nav className="menu-links" aria-label="More navigation">
              {NAV.map((item) => (
                <DialogClose asChild key={item.href}>
                  <Link href={item.href} aria-current={active(item.href) ? "page" : undefined}>
                    {item.label}
                  </Link>
                </DialogClose>
              ))}
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
