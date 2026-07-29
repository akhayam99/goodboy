import type { ReactNode } from 'react';

type Props = {
  readonly question: string;
  readonly children: ReactNode;
};

export const INSPECTOR_ACTION_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const InspectorSection = ({ question, children }: Props) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
      {question}
    </h3>
    {children}
  </section>
);
