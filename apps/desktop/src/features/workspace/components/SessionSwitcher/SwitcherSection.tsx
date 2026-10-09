import { Eyebrow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SwitcherRow } from './SwitcherRow';

type Props = {
  readonly label: string;
  readonly sessions: ReadonlyArray<Session | undefined>;
  readonly offset: number;
  readonly selectedIndex: number;
  readonly onChoose: (index: number) => void;
};

export const SwitcherSection = ({ label, sessions, offset, selectedIndex, onChoose }: Props) => (
  <>
    <Eyebrow label={label} muted className="px-3 pb-1 pt-1" />
    <div role="listbox" aria-label={label} className="flex flex-col">
      {sessions.map((session, index) =>
        session === undefined ? null : (
          <SwitcherRow
            key={session.id}
            session={session}
            isSelected={offset + index === selectedIndex}
            onChoose={() => onChoose(offset + index)}
          />
        ),
      )}
    </div>
  </>
);
