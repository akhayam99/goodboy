import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Divider } from '@goodboy/ui';
import { DogMascot } from '../../../shared/components/DogMascot';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { bridgeStatus } from '../../../features/companion/bridge';

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
      className="group/pair relative inline-flex shrink-0 items-center gap-1 rounded-full border border-border-soft/70 bg-gradient-to-b from-muted/40 to-muted/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:from-primary/15 hover:to-primary/5 hover:text-primary hover:shadow-md"
    >
      <Smartphone
        size={11}
        aria-hidden
        className="transition-transform duration-200 group-hover/pair:-rotate-6 group-hover/pair:scale-110"
      />
      <span>Pair</span>
      {linked ? (
        <span aria-hidden className="relative ml-0.5 flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
      ) : null}
    </button>
  );
}
