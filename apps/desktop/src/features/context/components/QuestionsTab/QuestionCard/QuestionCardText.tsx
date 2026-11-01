import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { cn, ICON_SIZE, Markdown } from '@goodboy/ui';
import type { QuestionParts } from '../questionParts';
import { QuestionBlockingMark } from './QuestionBlockingMark';

type Props = {
  readonly parts: QuestionParts;
  readonly isCompact: boolean;
  readonly isBlocking: boolean;
  readonly trailing?: ReactNode;
};

export const QuestionCardText = ({ parts, isCompact, isBlocking, trailing = null }: Props) => (
  <div className={cn('flex min-w-0 flex-col', isCompact ? 'gap-2' : 'gap-3')}>
    <div className={cn('flex min-w-0 flex-col', isCompact ? 'gap-1' : 'gap-2')}>
      <div data-question-header="" className="flex min-w-0 items-baseline gap-2">
        {isBlocking ? <QuestionBlockingMark /> : null}
        <h2
          className={cn(
            'min-w-0 flex-1 break-words text-foreground select-text',
            isCompact ? 'text-heading' : 'text-title',
          )}
        >
          {parts.title}
        </h2>
        {trailing === null ? null : <span className="shrink-0 self-start">{trailing}</span>}
      </div>
      {parts.context.length > 0 && (
        <Markdown
          text={parts.context}
          className={cn(
            'min-w-0 gap-2 break-words text-body text-muted-foreground select-text',
            isCompact && 'line-clamp-3',
          )}
        />
      )}
    </div>
    {!isCompact && parts.files.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {parts.files.map((file) => (
          <span
            key={file}
            className="inline-flex items-center gap-1 rounded-sm border border-border-soft bg-fill px-2 text-code text-muted-foreground"
          >
            <FileText size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
            {file}
          </span>
        ))}
      </div>
    )}
  </div>
);
