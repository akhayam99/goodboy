import { cn } from '@goodboy/ui';
import { LINE_FILL, SIGN_TEXT, WORD_FILL } from '../../../../../diff/lib/lineTone';
import type { TextChangeLine } from '../../../../../file-versions/textChangesOf';
import { CHANGE_ROW_GRID } from './changeRowGrid';

type LineProps = {
  readonly line: TextChangeLine;
  readonly isCode: boolean;
};

const TONE_OF = {
  same: 'context',
  add: 'add',
  del: 'del',
} as const satisfies Record<TextChangeLine['kind'], keyof typeof LINE_FILL>;

const SIGN_OF = {
  same: '',
  add: '+',
  del: '-',
} as const satisfies Record<TextChangeLine['kind'], string>;

const SPOKEN_OF = {
  same: '',
  add: 'Added: ',
  del: 'Removed: ',
} as const satisfies Record<TextChangeLine['kind'], string>;

export const ChangeLine = ({ line, isCode }: LineProps) => {
  const tone = TONE_OF[line.kind];
  return (
    <div
      role="row"
      data-line-kind={line.kind}
      className={cn(CHANGE_ROW_GRID, 'py-0.5', LINE_FILL[tone])}
    >
      <span
        role="cell"
        className="select-none pr-2 text-right text-meta tabular-nums text-faint-foreground"
      >
        {line.lineNumber}
      </span>
      <span role="cell" aria-hidden className={cn('select-none text-meta', SIGN_TEXT[tone])}>
        {SIGN_OF[line.kind]}
      </span>
      <span
        role="cell"
        className={cn(
          'min-w-0 whitespace-pre-wrap pr-4 text-foreground [overflow-wrap:anywhere]',
          isCode ? 'text-code' : 'text-body',
        )}
      >
        {SPOKEN_OF[line.kind] === '' ? null : (
          <span className="sr-only">{SPOKEN_OF[line.kind]}</span>
        )}
        {line.segments.map((segment, index) => (
          <span
            key={`${index}-${segment.text}`}
            className={cn(segment.isChanged && WORD_FILL[tone])}
          >
            {segment.text}
          </span>
        ))}
        {line.segments.every((segment) => segment.text === '') ? '\u00a0' : null}
      </span>
    </div>
  );
};
