import { useState } from 'react';
import { useAppStore } from '../store';
import { PricingDialog } from './PricingDialog';

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;

export function TelemetryPill() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const [open, setOpen] = useState(false);

  const sessionCost = sessionSummary?.estimatedCostUsd ?? 0;
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="open pricing breakdown"
        aria-label="open pricing breakdown"
        className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-0.5 text-xs hover:bg-muted/70"
      >
        <span className="font-medium">{formatCost(sessionCost)}</span>
        <span className="text-muted-foreground">session</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="font-medium">{formatCost(workspaceCost)}</span>
        <span className="text-muted-foreground">total</span>
      </button>
      <PricingDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
