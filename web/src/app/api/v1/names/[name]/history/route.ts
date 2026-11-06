import { BACKEND } from "@/lib/atto/backend";
import { reads } from "@/lib/atto/reads";

const HEADERS = { "x-atto-data": BACKEND };

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const clean = decodeURIComponent(name).toLowerCase();
  if (!(await reads.getReport(clean)))
    return Response.json({ error: "unknown name" }, { status: 404, headers: HEADERS });
  return Response.json(await reads.getHistory(clean), { headers: HEADERS });
}
