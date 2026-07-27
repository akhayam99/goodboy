import type { ReactNode } from 'react';
import { DogMascot } from '../../../../shared/components/DogMascot';

type Props = {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
};

export const AgentLaneEmpty = ({ title, description, action }: Props) => (
  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-6 py-10 text-center">
    <span
      aria-hidden
      className="flex size-12 items-center justify-center rounded-full bg-success/10"
    >
      <DogMascot size={26} className="text-success" />
    </span>
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description != null && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
    {action}
  </div>
);
