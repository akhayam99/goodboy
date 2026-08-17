import { Button } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly remaining: number;
  readonly canAdvance: boolean;
  readonly onAdvance: () => void;
};

export const TimelineGhostRow = ({ title, remaining, canAdvance, onAdvance }: Props) => (
  <div className="grid min-h-9 grid-cols-[44px_24px_minmax(0,1fr)]">
    <span />
    <div className="relative flex items-center justify-center">
      <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
      <span className="relative z-10 size-1.5 rounded-full border border-dashed border-muted-foreground bg-canvas" />
    </div>
    <div className="flex min-w-0 items-center gap-2 pl-5 py-1.5 text-muted-foreground">
      <span className="truncate text-sm">{title}</span>
      {remaining > 0 ? <span className="text-2xs">+{remaining} more steps</span> : null}
      {canAdvance ? (
        <Button variant="ghost" size="sm" onClick={onAdvance}>
          Start step
        </Button>
      ) : null}
    </div>
  </div>
);
