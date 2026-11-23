import { Input, useEscapeLayer } from '@goodboy/ui';
import { useQueueSends } from './useQueueSends';

type SendParams = {
  readonly text: string;
};

type Props = {
  readonly agentId: string;
  readonly who: string;
  readonly earlier: ReadonlyArray<string>;
  readonly onSend: (params: SendParams) => void;
  readonly onClose: () => void;
};

export const AgentPeek = ({ agentId, who, earlier, onSend, onClose }: Props) => {
  useEscapeLayer(onClose);
  const draft = useQueueSends((state) => state.drafts[agentId] ?? '');
  const setDraft = useQueueSends((state) => state.setDraft);
  const label = `Message the ${who}`;
  return (
    <div data-agent-peek={agentId} className="flex min-w-0 flex-col gap-2 pl-6">
      {earlier.length === 0 ? null : (
        <ol className="flex min-w-0 flex-col gap-1">
          {[...earlier].reverse().map((step, index) => (
            <li
              key={`${index}:${step}`}
              className="min-w-0 truncate text-meta text-muted-foreground"
            >
              {step}
            </li>
          ))}
        </ol>
      )}
      <Input
        aria-label={label}
        placeholder={label}
        value={draft}
        onChange={(event) => setDraft({ agentId, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || draft.trim() === '') {
            return;
          }
          event.preventDefault();
          onSend({ text: draft });
          setDraft({ agentId, text: '' });
        }}
      />
    </div>
  );
};
