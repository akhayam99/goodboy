import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Divider, StatusDot, formatUsd } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { bridgeStatus } from '../../../features/companion/bridge';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup } from '../../../store';

export const AppTopBar = () => (
  <>
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-between bg-background px-3"
    >
      <div className="flex items-center gap-1.5">
        <DogMascot size={15} className="shrink-0 text-foreground" />
        <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy</span>
        <UpdateIndicator variant="pip" />
      </div>
      <WorkspaceRollupStrip />
      <div className="flex items-center gap-2">
        <PairDeviceCta />
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/15">
          Beta
        </span>
      </div>
    </div>
    <Divider />
  </>
);

// App-header pairing entry-point, beside the Beta chip — twin of the hidden
// cmd+ctrl+shift+m shortcut. Polls bridge status to surface a presence dot.
function PairDeviceCta() {
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      bridgeStatus()
        .then((s) => {
          if (active) setLinked(s.running && s.enrolledCount > 0);
        })
        .catch(() => {});
    };
    refresh();
    const id = window.setInterval(refresh, 5000);
    const onChanged = () => refresh();
    window.addEventListener('goodboy:bridge-paired-changed', onChanged);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener('goodboy:bridge-paired-changed', onChanged);
    };
  }, []);

  const label = linked ? 'iPhone linked — manage' : 'Pair your iPhone';

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-pair-device'))}
      title={label}
      aria-label={label}
      className="group/pair relative inline-flex shrink-0 items-center gap-1 rounded-full border border-border-soft/70 bg-gradient-to-b from-muted/40 to-muted/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm motion-safe:transition-all hover:border-primary/40 hover:from-primary/15 hover:to-primary/5 hover:text-primary hover:shadow-md"
    >
      <Smartphone size={11} aria-hidden />
      <span>Pair</span>
      {linked ? (
        <span aria-hidden className="ml-0.5 size-1.5 shrink-0 rounded-full bg-success" />
      ) : null}
    </button>
  );
}

function WorkspaceRollupStrip() {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const rollup = useWorkspaceRollup(workspace?.id ?? null, sessions);
  if (!workspace) {
    return null;
  }
  return (
    <div className="flex items-center gap-3 text-2xs">
      {rollup.attentionCount > 0 ? (
        <span className="flex items-center gap-1">
          <StatusDot tone="warning" size="sm" pulsing />
          <span className="font-medium tabular-nums text-foreground">{rollup.attentionCount}</span>
          <span className="text-muted-foreground">need you</span>
        </span>
      ) : null}
      {rollup.runningCount > 0 ? (
        <span className="flex items-center gap-1">
          <StatusDot tone="info" size="sm" pulsing />
          <span className="font-medium tabular-nums text-foreground">{rollup.runningCount}</span>
          <span className="text-muted-foreground">running</span>
        </span>
      ) : null}
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {formatUsd(rollup.todaySpend)}
        </span>
        today
      </span>
    </div>
  );
}
