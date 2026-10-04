import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { IconButton, KbdPill, Textarea } from '@goodboy/ui';
import { composerPlaceholder } from './composerPlaceholder';
import { ReplyBar } from './ReplyBar';
import type { ConversationSource } from './types';
import type { ConversationModel } from './useConversation';
import { shortcutGlyphs } from '../../keyboard/registry';
import { isSubmitChord } from '../../keyboard/isSubmitChord';

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
    if (isSubmitChord(event)) {
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
    <div data-slot="conversation-composer" className="flex min-w-0 flex-col gap-2">
      {source.composerNote == null ? null : (
        <p className="text-meta text-muted-foreground">{source.composerNote}</p>
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
        <div className="flex min-w-0 items-center justify-between gap-2 px-3 pb-2">
          <span className="flex items-center gap-1 text-meta text-faint-foreground">
            <KbdPill className="h-4 text-chip">{shortcutGlyphs('composer.submit')}</KbdPill>
            to send
          </span>
          <IconButton icon={ArrowUp} label="Send" disabled={isEmpty} onClick={submit} />
        </div>
      </div>
    </div>
  );
};
