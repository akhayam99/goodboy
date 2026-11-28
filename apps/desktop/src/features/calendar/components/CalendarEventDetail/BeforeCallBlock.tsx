import { Eyebrow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { BeforeCallRow } from './BeforeCallRow';

type Props = {
  readonly sessions: ReadonlyArray<Session>;
};

export const BeforeCallBlock = ({ sessions }: Props) => (
  <section
    aria-label="Before this call"
    data-before-call-block=""
    className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle p-2"
  >
    <Eyebrow label="Before this call" />
    <ul className="flex min-w-0 flex-col">
      {sessions.map((session) => (
        <BeforeCallRow key={session.id} session={session} />
      ))}
    </ul>
  </section>
);
