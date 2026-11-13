import { useState } from 'react';
import { cn } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { FileHeader } from './components/DiffView/FileHeader';
import { HANGING_INDENT, LINE_FILL, SIGN_TEXT } from './lib/lineTone';

type Props = {
  readonly file: FileDiff;
};

const SIGN = { add: '+', del: '-', context: ' ' } as const;

export const FileChangeCard = ({ file }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <section
      aria-label={file.path}
      data-file-card=""
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-soft bg-background"
    >
      <FileHeader
        file={file}
        isCollapsed={isCollapsed}
        onToggleCollapsed={() => setIsCollapsed((isShut) => !isShut)}
        commentCount={0}
        viewed={null}
        onToggleViewed={null}
        onOpenInEditor={null}
        onShowWhole={null}
        onCommentOnFile={null}
        isCompact
      />
      {isCollapsed
        ? null
        : file.hunks.map((hunk) => (
            <div key={hunk.header} className="min-w-0 py-2 font-mono text-code">
              <p className="px-3 text-faint-foreground">{hunk.header}</p>
              {hunk.lines.map((line, index) => (
                <p
                  key={`${hunk.header}-${index}`}
                  className={cn('flex min-w-0 gap-3 px-3', LINE_FILL[line.kind])}
                >
                  <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[line.kind])}>
                    {SIGN[line.kind]}
                  </span>
                  <span
                    style={HANGING_INDENT}
                    className="min-w-0 whitespace-pre-wrap break-words text-foreground"
                  >
                    {line.text}
                  </span>
                </p>
              ))}
            </div>
          ))}
    </section>
  );
};
