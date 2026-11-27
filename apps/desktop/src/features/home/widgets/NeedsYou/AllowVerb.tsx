import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { usePermissionAsk } from '../../../permissions/permissionAsk';
import type { SessionPermissionAsk } from '../../../session/sessionPermissionAsk';

type Props = {
  readonly sessionId: SessionId;
  readonly ask: SessionPermissionAsk;
  readonly isFirst: boolean;
};

export const ALLOW_VERB = 'Allow and continue';

export const AllowVerb = ({ sessionId, ask, isFirst }: Props) => {
  const permission = usePermissionAsk({
    item: ask.ask,
    sessionId,
    agentId: ask.agentId,
    isDocked: false,
    onAnswered: () => undefined,
  });
  const look = actionButtonLookOf({ verb: ALLOW_VERB, variant: isFirst ? 'primary' : 'quiet' });
  return (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      data-home-verb=""
      disabled={permission.isBusy || !permission.canAct}
      onClick={permission.allow}
    >
      {ALLOW_VERB}
    </Button>
  );
};
