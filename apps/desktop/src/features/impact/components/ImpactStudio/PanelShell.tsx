import type { ReactNode } from 'react';
import { Divider, ScrollFade } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
};

export const PanelShell = ({ title, subtitle, children }: Props) => (
  <div className="flex h-full flex-col">
    <div className="flex flex-col gap-0.5 px-8 py-4">
      <span className="text-base font-semibold text-foreground">{title}</span>
      <span className="text-2xs text-muted-foreground">{subtitle}</span>
    </div>
    <Divider />
    <div className="min-h-0 flex-1">
      <ScrollFade className="mx-auto h-full max-w-5xl" viewportClassName="px-10 py-8" fadeSize={24}>
        <div className="flex flex-col gap-6">{children}</div>
      </ScrollFade>
    </div>
  </div>
);
