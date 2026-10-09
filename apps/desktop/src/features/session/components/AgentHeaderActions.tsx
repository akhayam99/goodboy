import { GhostActionButton, HeaderActions } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { ObjectOverflowMenu } from '../../actions/components/ObjectOverflowMenu';
import type { OnArm } from '../../../shared/components/HeaderConfirm/armedAction';
import { useActionEnv } from '../../actions/useActionEnv';
import { useObjectActions } from '../../actions/useObjectActions';

const STATE_BUTTONS = ['agent.interrupt', 'agent.close', 'agent.reopen'];
const DELETE_ACTION = 'agent.delete';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly onArm: OnArm;
  readonly allowInterrupt?: boolean;
  readonly onDeleted?: () => void;
};

export const AgentHeaderActions = ({
  agent,
  sessionId,
  onArm,
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
  const stateAction =
    STATE_BUTTONS.flatMap((id) => {
      if (id === 'agent.interrupt' && !allowInterrupt) {
        return [];
      }
      const found = actions.find((action) => action.id === id);
      return found === undefined ? [] : [found];
    })[0] ?? null;

  return (
    <HeaderActions
      slotClassNames={{ button: '@max-[560px]:hidden' }}
      button={
        stateAction === null ? null : (
          <GhostActionButton
            icon={stateAction.icon}
            label={stateAction.label.replace(/ agent$/, '')}
            onClick={() => void run({ actionId: stateAction.id })}
          />
        )
      }
      overflow={
        <ObjectOverflowMenu
          target={target}
          label="More agent actions"
          anchorKey={`agent-header:${agent.id}`}
          viewing={viewing}
          size="control"
          hideWhenEmpty
          onArm={({ action, run: runAction }) =>
            onArm({
              action,
              run: async () => {
                await runAction();
                if (action.id === DELETE_ACTION) {
                  onDeleted?.();
                }
              },
            })
          }
        />
      }
    />
  );
};
