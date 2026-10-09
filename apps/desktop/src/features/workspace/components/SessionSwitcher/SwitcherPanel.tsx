import { Eyebrow, FLOATING_SURFACE, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SwitcherSection } from './SwitcherSection';

type Props = {
  readonly sessions: ReadonlyArray<Session | undefined>;
  readonly pinnedCount: number;
  readonly selectedIndex: number;
  readonly onChoose: (index: number) => void;
};

export const SwitcherPanel = ({ sessions, pinnedCount, selectedIndex, onChoose }: Props) => (
  <div
    className={cn(
      FLOATING_SURFACE,
      'relative flex w-full max-w-105 flex-col gap-1 p-2 motion-safe:animate-studio-in',
    )}
  >
    {pinnedCount === 0 ? null : (
      <SwitcherSection
        label="Pinned"
        sessions={sessions.slice(0, pinnedCount)}
        offset={0}
        selectedIndex={selectedIndex}
        onChoose={onChoose}
      />
    )}
    <SwitcherSection
      label="Recent sessions"
      sessions={sessions.slice(pinnedCount)}
      offset={pinnedCount}
      selectedIndex={selectedIndex}
      onChoose={onChoose}
    />
    <div className="flex gap-3 px-3 pb-1 pt-2 text-chip text-faint-foreground">
      <span>{shortcutGlyphs('session.switcher')} next</span>
      <span>Release to open</span>
    </div>
  </div>
);
