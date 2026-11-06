import { Suspense } from "react";
import { OwnerPageView } from "./owner-view";

export const metadata = { title: "Owner page" };

export default function OwnerPage({ params }: { params: Promise<{ name: string }> }) {
  return (
    <Suspense fallback={<p className="frame soft">Checking who owns this name…</p>}>
      <OwnerPageView params={params} />
    </Suspense>
  );
}
