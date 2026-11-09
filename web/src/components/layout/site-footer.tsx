import Link from "next/link";
import { FooterMark } from "./footer-mark";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="frame site-footer-inner">
        <p>Where NEAR names change hands.</p>
        <nav aria-label="Legal">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/cookies">Cookies</Link>
        </nav>
      </div>
      <FooterMark />
    </footer>
  );
}
