import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/outfit";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { PersonaProvider } from "@/components/providers";
import { ConsentBanner, MockBar, SiteFooter, SiteHeader } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "ATTO", template: "%s | ATTO" },
  description: "A safer way to buy and sell NEAR names. ATTO holds the payment, transfers the name, and removes the previous owner's access before the sale completes.",
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
