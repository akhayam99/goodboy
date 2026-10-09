import { Eyebrow, FLOATING_SURFACE, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SwitcherRow } from './SwitcherRow';

type Props = {
  readonly sessions: ReadonlyArray<Session | undefined>;
  readonly selectedIndex: number;
  readonly onChoose: (index: number) => void;
};

export const SwitcherPanel = ({ sessions, selectedIndex, onChoose }: Props) => (
  <div
    className={cn(
      FLOATING_SURFACE,
      'relative flex w-full max-w-105 flex-col gap-1 p-2 motion-safe:animate-studio-in',
    )}
  >
    <Eyebrow label="Recent sessions" muted className="px-3 pb-1 pt-1" />
    <div role="listbox" aria-label="Recent sessions" className="flex flex-col">
      {sessions.map((session, index) =>
        session === undefined ? null : (
          <SwitcherRow
            key={session.id}
            session={session}
            isSelected={index === selectedIndex}
            onChoose={() => onChoose(index)}
          />
        ),
      )}
    </div>
    <div className="flex gap-3 px-3 pb-1 pt-2 text-chip text-faint-foreground">
      <span>{shortcutGlyphs('session.switcher')} next</span>
      <span>Release to open</span>
    </div>
  </div>
);
