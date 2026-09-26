import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { IconButton, KbdPill, Textarea } from '@goodboy/ui';
import { composerPlaceholder } from './composerPlaceholder';
import { ReplyBar } from './ReplyBar';
import type { ConversationSource } from './types';
import type { ConversationModel } from './useConversation';

type Props = {
  readonly source: ConversationSource;
  readonly model: ConversationModel;
};

export const ConversationComposer = ({ source, model }: Props) => {
  const [draft, setDraft] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const placeholder = composerPlaceholder({
    capabilities: source.capabilities,
    target: model.target,
  });
  const isEmpty = draft.trim() === '';

  useEffect(() => {
    if (model.focusToken === 0) {
      return;
    }
    boxRef.current?.querySelector('textarea')?.focus();
  }, [model.focusToken]);

  const submit = () => {
    if (isEmpty) {
      return;
    }
    model.send(draft);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape' && model.target != null) {
      event.preventDefault();
      event.stopPropagation();
      model.clearTarget();
    }
  };

  return (
    <div data-slot="conversation-composer" className="flex min-w-0 flex-col gap-1.5">
      {source.composerNote == null ? null : (
        <p className="text-secondary text-muted-foreground">{source.composerNote}</p>
      )}
      <div
        ref={boxRef}
        className="flex min-w-0 flex-col rounded-lg border border-border-soft bg-subtle focus-within:border-primary"
      >
        {model.target == null ? null : (
          <ReplyBar target={model.target} onClear={model.clearTarget} />
        )}
        <Textarea
          autoGrow
          minRows={2}
          maxRows={12}
          value={draft}
          aria-label={placeholder}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className="border-0 bg-transparent text-prose shadow-none focus-visible:shadow-none focus-visible:ring-0"
        />
        <div className="flex min-w-0 items-center justify-between gap-2 px-2.5 pb-1.5">
          <span className="flex items-center gap-1 text-meta text-faint-foreground">
            <KbdPill className="h-4 text-meta">⌘↵</KbdPill>
            to send
          </span>
          <IconButton icon={ArrowUp} label="Send" disabled={isEmpty} onClick={submit} />
        </div>
      </div>
    </div>
  );
};
