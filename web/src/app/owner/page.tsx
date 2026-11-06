import { Suspense } from "react";
import { MyNamesView } from "./my-names-view";

export const metadata = { title: "My names" };

export default function MyNamesPage() {
  return (
    <Suspense>
      <MyNamesView />
    </Suspense>
  );
}
