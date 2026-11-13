import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/outfit";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";
import { PersonaProvider } from "@/components/providers";
import { AlertProvider } from "@/components/ui/alert-modal";
import { ConsentBanner, MockBar, SiteFooter, SiteHeader } from "@/components/shell";

const DESCRIPTION =
  "A safer way to buy and sell NEAR names. ATTO holds the payment, transfers the name, and removes the previous owner's access before the sale completes.";

export const metadata: Metadata = {
  metadataBase: new URL("https://atto.namite.xyz"),
  title: { default: "ATTO", template: "%s | ATTO" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "ATTO", title: "ATTO", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "ATTO", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AlertProvider>
        <PersonaProvider>
          <Suspense>
            <MockBar />
            <SiteHeader />
          </Suspense>
          <main>{children}</main>
          <Suspense>
            <SiteFooter />
          </Suspense>
          <ConsentBanner />
        </PersonaProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
