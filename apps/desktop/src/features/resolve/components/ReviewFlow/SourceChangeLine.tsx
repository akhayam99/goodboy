import { cn } from '@goodboy/ui';
import { LINE_FILL, SIGN_TEXT } from '../../../diff/lib/lineTone';
import type { WordSegment } from '../../wordDiff';

export const SourceChangeLine = ({
  kind,
  segments,
}: {
  readonly kind: 'add' | 'del';
  readonly segments: ReadonlyArray<WordSegment>;
}) => (
  <p className={cn('flex min-w-0 gap-3 px-3 py-2 text-body', LINE_FILL[kind])}>
    <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[kind])}>
      {kind === 'add' ? '+' : '-'}
    </span>
    <span className="sr-only">{kind === 'add' ? 'After: ' : 'Before: '}</span>
    <span className="min-w-0 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={cn(
            segment.isChanged && kind === 'del' && 'text-muted-foreground line-through',
            segment.isChanged &&
              kind === 'add' &&
              'underline decoration-success underline-offset-2',
          )}
        >
          {segment.text}
        </span>
      ))}
    </span>
  </p>
);
