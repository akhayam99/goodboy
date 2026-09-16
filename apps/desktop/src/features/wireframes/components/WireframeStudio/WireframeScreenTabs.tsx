import { ScrollFade, cn } from '@goodboy/ui';
import type { WireframeScreen } from '@goodboy/core';

type Props = {
  readonly screens: ReadonlyArray<WireframeScreen>;
  readonly currentScreenId: string;
  readonly onSelect: (screenId: string) => void;
};

export const WireframeScreenTabs = ({ screens, currentScreenId, onSelect }: Props) => (
  <ScrollFade orientation="horizontal" className="min-w-24 flex-1" fadeSize={16}>
    <div
      role="tablist"
      aria-label="Wireframe screens"
      data-testid="wireframe-screen-tabs"
      className="flex min-w-0 flex-nowrap items-center gap-1"
    >
      {screens.map((screen) => {
        const isCurrent = screen.id === currentScreenId;
        return (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            onClick={() => onSelect(screen.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-2xs motion-safe:transition-colors',
              isCurrent
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/50',
            )}
          >
            <span className="max-w-40 truncate">{screen.title}</span>
            <span className="shrink-0 text-muted-foreground/70">{screen.viewport}</span>
          </button>
        );
      })}
    </div>
  </ScrollFade>
);
