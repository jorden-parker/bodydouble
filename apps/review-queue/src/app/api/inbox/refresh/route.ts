import { refreshGitHubCache } from "@/lib/review/services";

export function POST() {
  refreshGitHubCache();
  return Response.json({ refreshedAt: new Date().toISOString() });
}
