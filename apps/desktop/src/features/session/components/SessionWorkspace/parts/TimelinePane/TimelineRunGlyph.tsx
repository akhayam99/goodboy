import type { ComponentProps } from 'react';
import { cn } from '@goodboy/ui';
import type { RunWorkflowKind } from '../../../../timeline/runWorkflowKind';
import { RUN_KIND_GLYPH } from './runKindGlyph';

type Props = Omit<ComponentProps<'span'>, 'children' | 'className'> & {
  readonly kind: RunWorkflowKind;
  readonly label?: string;
  readonly isMuted?: boolean;
};

const GLYPH_SIZE = 10;

export const TimelineRunGlyph = ({ kind, label, isMuted = false, ...anchorProps }: Props) => {
  const { icon: Icon } = RUN_KIND_GLYPH[kind];
  return (
    <span
      {...anchorProps}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      data-testid="run-glyph"
      className={cn(
        'inline-flex size-4.5 shrink-0 items-center justify-center self-center rounded-full bg-current/12 motion-safe:transition-colors',
        isMuted ? 'text-faint-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon size={GLYPH_SIZE} aria-hidden />
    </span>
  );
};
