import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { PersonaProvider } from "@/components/providers";
import { ConsentBanner, MockBar, SiteFooter, SiteHeader } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "ATTO", template: "%s | ATTO" },
  description: "See what a NEAR name is still tied to, and buy it with nothing left attached.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <PersonaProvider>
          <Suspense>
            <MockBar />
            <SiteHeader />
          </Suspense>
          <main>{children}</main>
          <SiteFooter />
          <ConsentBanner />
        </PersonaProvider>
      </body>
    </html>
  );
}
