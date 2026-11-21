import { Button, Chip, ICON_SIZE, IconButton, Notice, Skeleton } from '@goodboy/ui';
import { X } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../conceptIcons';
import { NAMES } from '../../utils/names';
import { AskLineMessage } from './AskLineMessage';
import type { AskLineAnswerView, AskLineMessageView } from './AskLineView';

type Props = {
  readonly view: AskLineAnswerView;
  readonly message: AskLineMessageView | null;
  readonly onClose: () => void;
  readonly onOpenInAsk: () => void;
  readonly onRetry: () => void;
};

const AskIcon = CONCEPT_ICONS.ask;

export const AskLineAnswer = ({ view, message, onClose, onOpenInAsk, onRetry }: Props) => (
  <section
    aria-label="Answer"
    aria-busy={view.phase === 'thinking'}
    data-testid="ask-line-answer"
    className="flex min-w-0 flex-col gap-2 rounded-md bg-subtle p-3"
  >
    <div className="flex min-w-0 items-center gap-2">
      <AskIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
        {view.question}
      </span>
      <IconButton icon={X} label="Close answer" variant="ghost" onClick={onClose} />
    </div>
    {view.phase === 'thinking' ? (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    ) : null}
    {view.phase === 'answered' ? (
      <>
        <p className="text-prose text-foreground">{view.text}</p>
        {view.sources.length > 0 ? (
          <ul aria-label="Sources" className="flex flex-wrap gap-1">
            {view.sources.map((source) => (
              <li key={source}>
                <Chip tone="neutral" kind="reference" label={source} />
              </li>
            ))}
          </ul>
        ) : null}
        {message === null ? null : <AskLineMessage message={message} />}
      </>
    ) : null}
    {view.phase === 'failed' ? (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Couldn't answer"
        detail={view.error}
        actions={
          <Button variant="secondary" size="xs" onClick={onRetry}>
            {NAMES.retry}
          </Button>
        }
      />
    ) : null}
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Chip tone="neutral" kind="reference" label={view.origin} testId="ask-line-origin" />
      <span className="min-w-0 flex-1 text-meta text-faint-foreground">{view.note}</span>
      <Button variant="ghost" size="xs" onClick={onOpenInAsk}>
        {NAMES.openInAsk}
      </Button>
    </div>
  </section>
);
