import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

export const IntentComposer = ({ sessionId }: Props) => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  const [intent, setIntent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const prompt = intent.trim();
    if (prompt.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      await spawnAgent(sessionId, { initialPrompt: prompt, focus: 'agent' });
      setIntent('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Start work" className="flex flex-col gap-2">
      <div
        className={cn(
          'flex items-end gap-2 rounded-lg border border-border-soft bg-elevated p-2',
          'focus-within:border-primary/60',
        )}
      >
        <textarea
          value={intent}
          rows={3}
          aria-label="What should happen in this session?"
          placeholder="Describe what you want to get done. An agent picks it up from here."
          disabled={busy}
          onChange={(event) => setIntent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          className="min-h-0 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <Tooltip content="Start an agent on this" anchorClassName="shrink-0">
          <button
            type="button"
            aria-label="Start an agent on this"
            disabled={busy || intent.trim().length === 0}
            onClick={() => void submit()}
            className={cn(
              'flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground motion-safe:transition-opacity',
              (busy || intent.trim().length === 0) && 'opacity-40',
            )}
          >
            <ArrowUp size={14} aria-hidden />
          </button>
        </Tooltip>
      </div>
      <p className="text-xs text-muted-foreground">
        You can also link tasks, attach a workflow, or explore the code from here as the session
        grows.
      </p>
    </section>
  );
};
