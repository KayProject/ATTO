import { Suspense } from "react";
import { HomeView } from "./home-view";

export default function HomePage() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}
