import type { ReactNode } from 'react';

type Props = {
  readonly caption: string;
  readonly width: number;
  readonly children: ReactNode;
};

export const FootPanel = ({ caption, width, children }: Props) => (
  <section data-foot-panel={caption} className="flex shrink-0 flex-col gap-2">
    <h2 className="text-eyebrow text-muted-foreground">{caption}</h2>
    <aside
      aria-label={`Sidebar, ${caption.toLowerCase()}`}
      className="flex flex-col justify-end border border-border bg-background py-2"
      style={{ width, height: 160 }}
    >
      {children}
    </aside>
  </section>
);
