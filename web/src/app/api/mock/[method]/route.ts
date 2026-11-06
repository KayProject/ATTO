import { z } from "zod";
import { METHODS } from "@/lib/atto/mock/dispatch";
import { Refusal } from "@/lib/atto/mock/world";

const Body = z.object({ as: z.string().min(1), args: z.unknown().default({}) });
const HEADERS = { "x-atto-data": "mock" };

export async function POST(request: Request, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  const handler = Object.hasOwn(METHODS, method) ? METHODS[method] : undefined;
  if (!handler) return Response.json({ error: "unknown method" }, { status: 404, headers: HEADERS });
  try {
    const { as, args } = Body.parse(await request.json());
    return Response.json({ result: (await handler(as, args)) ?? null }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof Refusal) return Response.json({ error: error.message }, { status: 400, headers: HEADERS });
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "invalid request" }, { status: 400, headers: HEADERS });
    }
    throw error;
  }
}
