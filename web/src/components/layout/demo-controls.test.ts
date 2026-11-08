import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  persona: "seller",
  account: "maya.near",
  accounts: { seller: "maya.near", buyer: "buyer.near", owner: "ife.near", stranger: "stranger.near" },
  setPersona: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../providers", () => ({ usePersona: () => state }));
import { MockBar } from "./demo-controls";

describe("demo controls hydration", () => {
  it("keeps the initial boundary markup independent of saved persona and sandbox account updates", () => {
    const initial = renderToStaticMarkup(createElement(MockBar));
    state.persona = "owner";
    state.account = "ife.near";
    state.accounts = { ...state.accounts, seller: "sandbox-seller.test.near" };
    const saved = renderToStaticMarkup(createElement(MockBar));
    expect(saved).toBe(initial);
    expect(saved).not.toContain("maya.near");
    expect(saved).not.toContain("ife.near");
    expect(saved).not.toContain("sandbox-seller.test.near");
    expect(saved).toContain("Demo controls");
  });
});
