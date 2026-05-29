import { useShallow } from 'zustand/react/shallow';
import { ArrowUpCircle, Loader2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = { variant: 'bar' | 'pip' };

// Non-invasive "update ready" affordance, shown only when a newer release has
// been found. Click downloads + installs + relaunches. Rendered both in the
// status bar (bar) and next to the sidebar logo (pip), à la VS Code / Claude.
export function UpdateIndicator({ variant }: Props) {
  const { status, version, installUpdate } = useAppStore(
    useShallow((s) => ({
      status: s.updaterStatus,
      version: s.updateVersion,
      installUpdate: s.installUpdate,
    })),
  );

  if (status !== 'available' && status !== 'downloading') return null;

  const downloading = status === 'downloading';
  const label = downloading
    ? 'Downloading update, the app will restart'
    : `Restart to update${version ? ` to ${version}` : ''}`;
  const Icon = downloading ? Loader2 : ArrowUpCircle;

  if (variant === 'pip') {
    return (
      <button
        type="button"
        onClick={() => void installUpdate()}
        disabled={downloading}
        title={label}
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/70 disabled:opacity-60"
      >
        <Icon size={13} className={cn(downloading && 'animate-spin')} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void installUpdate()}
      disabled={downloading}
      title={label}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
    >
      <Icon size={11} className={cn(downloading && 'animate-spin')} aria-hidden />
      <span>{downloading ? 'Updating…' : 'Restart to update'}</span>
    </button>
  );
}
