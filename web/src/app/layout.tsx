import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/dm-sans";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { PersonaProvider } from "@/components/providers";
import { ConsentBanner, MockBar, SiteFooter, SiteHeader } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "ATTO", template: "%s | ATTO" },
  description: "Inspect a NEAR name and review its connections before a sale.",
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
