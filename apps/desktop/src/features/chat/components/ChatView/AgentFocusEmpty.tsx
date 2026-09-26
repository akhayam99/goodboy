import { cn, PANE_RHYTHM } from '@goodboy/ui';
import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';
import { getAgentVisual } from '../../../../shared/components/AgentAvatar';

type Props = {
  readonly kind: AgentKind;
};

export const AgentFocusEmpty = ({ kind }: Props) => {
  const meta = AGENT_KIND_META[kind];
  const visual = getAgentVisual(kind);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-6 py-16 text-center',
        PANE_RHYTHM.column,
      )}
    >
      <p className="flex items-center gap-2 text-body text-foreground">
        {visual.image ? (
          <span
            aria-hidden
            data-testid="agent-focus-glyph"
            className="size-5 shrink-0"
            style={{
              backgroundColor: visual.color,
              maskImage: `url(${visual.image})`,
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              maskSize: 'contain',
              WebkitMaskImage: `url(${visual.image})`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              WebkitMaskSize: 'contain',
            }}
          />
        ) : null}
        <span>
          <span className="font-medium">{meta.noun}</span>: {meta.hint}.
        </span>
      </p>
      <p className="text-label text-faint-foreground">
        It shares the session brief with every other agent.
      </p>
    </div>
  );
};
