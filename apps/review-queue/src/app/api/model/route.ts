import { currentModelStatus } from "@/lib/review/services";

export async function GET() {
  return Response.json(await currentModelStatus());
}
