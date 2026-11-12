import Image from "next/image";
import Link from "next/link";
import { FastForward } from "@phosphor-icons/react/dist/ssr";
import "./owner-gate.css";

/** Full-screen stand-in for the owner page when the viewer does not own the name. */
export function OwnerGate({ name }: { name: string }) {
  return (
    <section className="owner-gate" aria-labelledby="owner-gate-title">
      <h1 id="owner-gate-title" className="owner-gate-title">
        Owners
        <br />
        only.
      </h1>
      <p className="owner-gate-sub">
        Only the wallet that holds <strong>{name}</strong> can open its owner page. Anyone can still read the
        name&apos;s <Link href={`/names/${name}`}>public report</Link>.
      </p>
      <Link href="/" className="owner-gate-button">
        <span>Back to safety</span>
        <FastForward weight="bold" aria-hidden />
      </Link>
      <Image
        className="owner-gate-vault"
        src="/glass/vault.webp"
        alt=""
        width={700}
        height={679}
        priority
        sizes="(max-width: 40rem) 80vw, 460px"
      />
    </section>
  );
}
