import { z } from "zod";
import { BACKEND } from "@/lib/atto/backend";
import { METHODS } from "@/lib/atto/mock/dispatch";
import { PERSONAS, type PersonaKey } from "@/lib/atto/mock/seeds";
import { Refusal } from "@/lib/atto/mock/world";
import { SANDBOX_METHODS, sandboxAccount } from "@/lib/atto/sandbox";

const Body = z.object({
  persona: z.enum(Object.keys(PERSONAS) as [PersonaKey, ...PersonaKey[]]),
  args: z.unknown().default({}),
});
const HEADERS = { "x-atto-data": BACKEND };

async function accountFor(persona: PersonaKey) {
  return BACKEND === "sandbox" ? sandboxAccount(persona) : PERSONAS[persona].account;
}

/** The account behind each persona, so the page can tell the seller from the buyer. */
async function accounts() {
  const keys = Object.keys(PERSONAS) as PersonaKey[];
  return Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await accountFor(k)])));
}

export async function POST(request: Request, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  const table = BACKEND === "sandbox" ? SANDBOX_METHODS : METHODS;
  const handler = method === "accounts" ? () => accounts() : Object.hasOwn(table, method) ? table[method] : undefined;
  if (!handler) return Response.json({ error: "unknown method" }, { status: 404, headers: HEADERS });
  try {
    const { persona, args } = Body.parse(await request.json());
    return Response.json({ result: (await handler(await accountFor(persona), args)) ?? null }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof Refusal) return Response.json({ error: error.message }, { status: 400, headers: HEADERS });
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "invalid request" }, { status: 400, headers: HEADERS });
    }
    throw error;
  }
}
