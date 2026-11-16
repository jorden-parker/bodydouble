import type { Metadata } from "next";
import { AssignedTickets } from "@/components/tickets/assigned-tickets";

export const metadata: Metadata = { title: "Tickets · Tally" };

export default function TicketsPage() {
  return <AssignedTickets />;
}
