import type { Metadata } from "next";
import { SearchView } from "./search-view";
export const metadata: Metadata = { title: "Inspect a name" };
export default function Page() {
  return <SearchView />;
}
