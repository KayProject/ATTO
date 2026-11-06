import { z } from "zod";
import { getWorld } from "@/lib/atto/mock/singleton";

const HEADERS = { "x-atto-data": "mock" };
const Days = z.coerce.number().int().min(1).max(3650).default(7);

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const raw = new URL(request.url).searchParams.get("days");
  const days = Days.safeParse(raw ?? undefined);
  if (!days.success) {
    return Response.json({ error: "days must be a whole number from 1 to 3650" }, { status: 400, headers: HEADERS });
  }
  const answer = getWorld().changedOwner(decodeURIComponent(name).toLowerCase(), days.data);
  if (!answer) return Response.json({ error: "unknown name" }, { status: 404, headers: HEADERS });
  return Response.json(answer, { headers: HEADERS });
}
