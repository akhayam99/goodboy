import { Button, Tooltip } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { permissionSubjectOf } from '../../../permissions/permissionSubjectOf';
import type { OpenPermissionAsk } from '../../../permissions/openPermissionAsksOf';
import { usePermissionAsk } from '../../../permissions/components/PermissionRequestCard/usePermissionAsk';
import { NeedsYouTile } from '../MoveCard/NeedsYouTile';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly ask: OpenPermissionAsk;
  readonly isPrimary: boolean;
};

const ALLOW = 'Allow and continue';

const PERMISSION = 'Permission';

const noop = (): void => undefined;

export const NeedsYouPermission = ({ sessionId, agentId, ask, isPrimary }: Props) => {
  const permission = usePermissionAsk({
    item: ask,
    sessionId,
    agentId,
    isDocked: false,
    onAnswered: noop,
  });
  const look = actionButtonLookOf({ verb: ALLOW, variant: isPrimary ? 'primary' : 'quiet' });
  const allow = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      data-move-verb=""
      className="shrink-0"
      disabled={permission.isBusy || !permission.canAct}
      onClick={permission.allow}
    >
      {ALLOW}
    </Button>
  );
  return (
    <NeedsYouTile
      moveId={`permission:${ask.toolUseId}`}
      sentKey={null}
      isPrimary={isPrimary}
      title={permission.title}
      meta={joinFacts({
        facts: [PERMISSION, permissionSubjectOf({ toolName: ask.toolName, input: ask.input })],
      })}
      actions={
        isPrimary ? (
          <Tooltip content={ALLOW} shortcut="list.open">
            {allow}
          </Tooltip>
        ) : (
          allow
        )
      }
      below={null}
    />
  );
};
