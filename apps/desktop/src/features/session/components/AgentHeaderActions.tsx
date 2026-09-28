import { useState } from 'react';
import { GhostActionButton, InlineConfirm, formatError } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../actions/components/ObjectOverflowMenu';
import { useActionEnv } from '../../actions/useActionEnv';
import { useObjectActions } from '../../actions/useObjectActions';
import type { ResolvedAction } from '../../actions/types';

const HEADER_BUTTONS = ['agent.close', 'agent.reopen', 'agent.interrupt', 'agent.delete'];

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly allowInterrupt?: boolean;
  readonly onDeleted?: () => void;
};

export const AgentHeaderActions = ({
  agent,
  sessionId,
  allowInterrupt = false,
  onDeleted,
}: Props) => {
  const viewing = { kind: 'agent', id: agent.id } as const;
  const env = useActionEnv({
    origin: 'button',
    anchorKey: `agent-header:${agent.id}`,
    viewing,
  });
  const target = { kind: 'agent', sessionId, agentId: agent.id } as const;
  const { actions, run } = useObjectActions({ target, env });
  const [armed, setArmed] = useState<ResolvedAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttons = actions.filter(
    (action) =>
      HEADER_BUTTONS.includes(action.id) && (allowInterrupt || action.id !== 'agent.interrupt'),
  );

  const runArmed = async (action: ResolvedAction) => {
    try {
      await run({ actionId: action.id });
    } catch (cause) {
      setError(`Couldn't finish that. ${formatError(cause)}`);
      return;
    }
    setArmed(null);
    if (action.id === 'agent.delete') {
      onDeleted?.();
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {buttons.map((action) => (
          <GhostActionButton
            key={action.id}
            icon={action.icon}
            label={action.label.replace(/ agent$/, '')}
            tone={action.confirm?.role === 'danger' ? 'danger' : 'neutral'}
            onClick={() => {
              setError(null);
              if (action.confirm !== null) {
                setArmed(action);
                return;
              }
              void run({ actionId: action.id });
            }}
          />
        ))}
        <ObjectOverflowMenu
          target={target}
          label="More agent actions"
          anchorKey={`agent-header:${agent.id}`}
          viewing={viewing}
        />
      </div>
      {armed !== null && armed.confirm !== null ? (
        <InlineConfirm
          role={armed.confirm.role}
          icon={<armed.icon size={ICON_SIZE.row} aria-hidden />}
          title={armed.confirm.title}
          description={armed.confirm.description}
          confirmLabel={armed.confirm.confirmLabel}
          note={
            error !== null ? (
              <p role="alert" className="text-secondary text-danger">
                {error}
              </p>
            ) : null
          }
          onConfirm={() => runArmed(armed)}
          onCancel={() => setArmed(null)}
        />
      ) : null}
    </div>
  );
};
