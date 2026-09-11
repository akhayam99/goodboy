import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSessionSlots } from '../../../../store';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { withShortcutHint } from '../../../../shared/keyboard/registry';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import { sessionContextDigest, type DigestEntry } from './sessionContextDigest';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

type RowProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly entry: DigestEntry;
  readonly empty: string;
  readonly unit: string;
  readonly shortcut: ShortcutId;
  readonly onOpen: () => void;
};

const DigestRow = ({ icon: Icon, label, entry, empty, unit, shortcut, onOpen }: RowProps) => {
  const count = `${entry.count} ${entry.count === 1 ? unit : `${unit}s`}`;
  const tooltip = withShortcutHint({
    label: entry.count === 0 ? `${label}: ${empty}` : `${label}: ${count}`,
    shortcut,
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      title={tooltip}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left motion-safe:transition-colors',
        'hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground/70" />
      <span className="shrink-0 text-2xs font-medium text-foreground">{label}</span>
      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
        {entry.count === 0 ? empty : count}
      </span>
      {entry.excerpt === '' ? null : (
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {entry.excerpt}
        </span>
      )}
    </button>
  );
};

export const ContextDigest = ({ sessionId, onSelectLens }: Props) => {
  const slots = useSessionSlots(sessionId);
  const digest = useMemo(
    () =>
      sessionContextDigest({
        decisions: slots.find((slot) => slot.key === 'decisions')?.value ?? '',
        summary: slots.find((slot) => slot.key === 'last_output_summary')?.value ?? '',
      }),
    [slots],
  );

  return (
    <section aria-label="Context digest" className="flex min-w-0 flex-col">
      <DigestRow
        icon={CONCEPT_ICONS.decisions}
        label="Decisions"
        entry={digest.decisions}
        empty="none yet"
        unit="row"
        shortcut="lens.decisions"
        onOpen={() => onSelectLens('decisions')}
      />
      <DigestRow
        icon={CONCEPT_ICONS.sessionSummary}
        label="Session summary"
        entry={digest.summary}
        empty="none yet"
        unit="block"
        shortcut="lens.summary"
        onOpen={() => onSelectLens('last_output_summary')}
      />
    </section>
  );
};
