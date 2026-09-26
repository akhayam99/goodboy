import { Markdown, Band, cn } from '@goodboy/ui';
import type { Agent, OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion | null;
  readonly asker: Agent | null;
};

export const AgentAnsweringFor = ({ sessionId, question, asker }: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  if (question === null) {
    return null;
  }

  return (
    <Band inset="content" label="Answering for" hint="This answer lands as the user's own.">
      <div className="flex flex-col gap-2">
        <blockquote className="border-l-2 border-border pl-2 text-body text-foreground">
          <Markdown text={question.text} className="min-w-0 gap-2 break-words leading-relaxed" />
        </blockquote>
        {asker !== null && (
          <button
            type="button"
            onClick={() => void selectAgent(sessionId, asker.id)}
            className={cn(
              'self-start rounded-sm px-1.5 py-0.5 text-secondary font-medium text-muted-foreground',
              'transition-colors duration-150 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            )}
          >
            asked by {asker.name}
          </button>
        )}
      </div>
    </Band>
  );
};
