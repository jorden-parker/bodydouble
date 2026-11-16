import type { Metadata } from "next";
import { WorkLog } from "@/components/work/work-log";

export const metadata: Metadata = { title: "Work Log · Tally" };

export default function WorkPage() {
  return <WorkLog />;
}
