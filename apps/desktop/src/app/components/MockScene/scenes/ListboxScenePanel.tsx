import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ListboxScenePanel = ({ label, children }: Props) => (
  <section aria-label={label} className="flex w-72 flex-col gap-2">
    <Eyebrow label={label} />
    <div className="flex flex-col rounded-lg border border-border bg-floating p-1 shadow-lg">
      {children}
    </div>
  </section>
);
