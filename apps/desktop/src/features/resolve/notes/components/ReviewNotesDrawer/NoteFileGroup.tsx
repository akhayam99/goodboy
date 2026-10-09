import type { ReactNode } from 'react';
import { MiddleText } from '../../../../../shared/components/MiddleText';

type Props = {
  readonly path: string | null;
  readonly children: ReactNode;
};

const LAST_SEGMENT = /[^/]*$/;

export const NoteFileGroup = ({ path, children }: Props) => (
  <section
    aria-label={path ?? 'Notes without a file'}
    data-note-file={path ?? ''}
    className="flex min-w-0 flex-col gap-4"
  >
    {path === null ? null : (
      <h3 className="flex min-w-0 font-mono text-meta text-muted-foreground" title={path}>
        <MiddleText value={path} tail={LAST_SEGMENT} />
      </h3>
    )}
    <ul className="flex min-w-0 flex-col gap-8">{children}</ul>
  </section>
);
