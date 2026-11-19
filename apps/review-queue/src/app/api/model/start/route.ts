import { startCurrentModel } from "@/lib/review/services";

export async function POST() {
  return Response.json(await startCurrentModel());
}
