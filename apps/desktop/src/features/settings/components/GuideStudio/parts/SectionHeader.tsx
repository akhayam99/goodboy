import type { ReactNode } from 'react';
import { IconTile, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly tone: Tone | 'muted';
};

export const SectionHeader = ({ icon, title, description, tone }: Props) => (
  <div className="flex items-start gap-3">
    <IconTile size="sm" tone={tone === 'muted' ? 'neutral' : tone} ring={false} className="mt-0.5">
      {icon}
    </IconTile>
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  </div>
);
