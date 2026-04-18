import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { IncidentDetailSurface } from "@/components/incident-detail-surface";
import type { Ticket } from "@/lib/triage";

export const Route = createFileRoute("/incident/$ticketId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", params.ticketId)
      .maybeSingle();

    if (error || !data) {
      throw redirect({ to: "/" });
    }

    return { ticket: data as Ticket };
  },
  component: IncidentPage,
});

function IncidentPage() {
  const { ticket } = Route.useLoaderData();
  const router = useRouter();

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
          // Map / tickets views refresh via Supabase realtime when we navigate back.
        }}
      />
    </div>
  );
}
