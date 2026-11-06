import { getWorld } from "@/lib/atto/mock/singleton";

const HEADERS = { "x-atto-data": "mock" };

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const world = getWorld();
  const clean = decodeURIComponent(name).toLowerCase();
  if (!world.getReport(clean)) return Response.json({ error: "unknown name" }, { status: 404, headers: HEADERS });
  return Response.json(world.getHistory(clean), { headers: HEADERS });
}
