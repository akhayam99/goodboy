import { useContext, useState, type ReactNode } from 'react';
import { WrapText } from 'lucide-react';
import { cn } from '../../cn';
import { ICON_SIZE } from '../../iconSize';
import { Button } from '../Button';
import { ScrollFade } from '../ScrollFade';
import { CodeBlockActionsContext } from './codeBlockActions';

type Props = {
  readonly content: string;
  readonly lang: string | null;
  readonly isClosed: boolean;
  readonly children: ReactNode;
};

export const CodeBlockFrame = ({ content, lang, isClosed, children }: Props) => {
  const Actions = useContext(CodeBlockActionsContext);
  const [isWrapped, setIsWrapped] = useState(false);
  return (
    <div
      data-block="code"
      className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-md bg-muted px-3 py-2"
    >
      <div data-slot="code-block-header" className="flex h-6 items-center justify-between gap-2">
        <span
          data-slot="code-block-lang"
          className="min-w-0 truncate text-meta text-muted-foreground"
        >
          {lang ?? ''}
        </span>
        {isClosed ? (
          <div data-slot="code-block-actions" className="flex items-center gap-1">
            <Button
              variant="quiet"
              size="xs"
              aria-pressed={isWrapped}
              onClick={() => setIsWrapped((wasWrapped) => !wasWrapped)}
            >
              <WrapText size={ICON_SIZE.row} aria-hidden />
              Wrap
            </Button>
            {Actions === null ? null : <Actions content={content} lang={lang} />}
          </div>
        ) : null}
      </div>
      <ScrollFade orientation="horizontal" fadeEdges="end" fadeSize="w-4">
        <pre
          className={cn(
            'text-ui font-mono text-foreground',
            isWrapped && 'whitespace-pre-wrap wrap-anywhere',
          )}
        >
          <code>{children}</code>
        </pre>
      </ScrollFade>
    </div>
  );
};
