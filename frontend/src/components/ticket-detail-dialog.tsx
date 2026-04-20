import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { Ticket } from "@/lib/triage";
import { cn } from "@/lib/utils";
import { IncidentDetailSurface } from "@/components/incident-detail-surface";

interface TicketDetailDialogProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** When set (e.g. mock dashboard), save updates locally instead of Supabase. */
  onLocalSave?: (ticket: Ticket) => void;
}

export function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
  onSaved,
  onLocalSave,
}: TicketDetailDialogProps) {
  if (!ticket) return null;

  const idShort = ticket.number ? String(ticket.number) : ticket.id.slice(0, 7).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] min-h-0 w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-none sm:rounded-none",
          "[&>button.absolute]:hidden",
        )}
      >
        <VisuallyHidden>
          <DialogTitle>Incident #{idShort}</DialogTitle>
          <DialogDescription>Full incident record</DialogDescription>
        </VisuallyHidden>

        <IncidentDetailSurface
          ticket={ticket}
          variant="dialog"
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
          onLocalSave={onLocalSave}
        />
      </DialogContent>
    </Dialog>
  );
}
