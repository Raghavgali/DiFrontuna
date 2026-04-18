import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTicket } from "@/lib/api";
import { IncidentDetailSurface } from "@/components/incident-detail-surface";
import type { Ticket } from "@/lib/triage";

const DETAIL_POLL_INTERVAL_MS = 2000;

export const Route = createFileRoute("/incident/$ticketId")({
  loader: async ({ params }) => {
    try {
      const ticket = await getTicket(params.ticketId);
      return { ticket };
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: IncidentPage,
});

function IncidentPage() {
  const { ticket: initialTicket } = Route.useLoaderData();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket>(initialTicket);

  // Poll this ticket so the transcript + classification update live during a call.
  // Stop polling once the call has ended and the ticket is resolved.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const fresh = await getTicket(ticket.id);
        if (!cancelled) setTicket(fresh);
      } catch {
        // swallow; next tick will retry
      }
    };

    const interval = window.setInterval(refresh, DETAIL_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [ticket.id]);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <IncidentDetailSurface
        ticket={ticket}
        variant="page"
        onClose={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.history.back();
          } else {
            void router.navigate({ to: "/" });
          }
        }}
        onSaved={() => {
          // Map / tickets views refresh via HTTP polling when we navigate back.
        }}
      />
    </div>
  );
}
