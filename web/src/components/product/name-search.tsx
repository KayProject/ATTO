"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
export function NameSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  function submit(event: FormEvent) {
    event.preventDefault();
    const name = query.trim().toLowerCase();
    if (name) router.push(`/names/${encodeURIComponent(name)}`);
  }
  return (
    <form role="search" onSubmit={submit}>
      <label className="search-label" htmlFor="inspect-name">
        NEAR name
      </label>
      <div className="search">
        <input
          id="inspect-name"
          type="search"
          placeholder="bakery.food"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={!query.trim()}>
          Inspect name
        </Button>
      </div>
    </form>
  );
}
