import { useState } from 'react';
import { Button, ScrollFade, Tooltip } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { permissionSubjectOf } from '../../../permissions/permissionSubjectOf';
import type { OpenPermissionAsk } from '../../../permissions/openPermissionAsksOf';
import { formatRequestInput } from '../../../permissions/components/PermissionRequestCard/formatRequestInput';
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

const SHOW = 'Show full request';

const HIDE = 'Hide full request';

const noop = (): void => undefined;

export const NeedsYouPermission = ({ sessionId, agentId, ask, isPrimary }: Props) => {
  const permission = usePermissionAsk({
    item: ask,
    sessionId,
    agentId,
    isDocked: false,
    onAnswered: noop,
  });
  const [isOpen, setIsOpen] = useState(false);
  const full = formatRequestInput({ input: ask.input });
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
      below={
        full === null ? null : (
          <div className="flex min-w-0 flex-col gap-1">
            <Button
              size="xs"
              variant="quiet"
              className="self-start"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((current) => !current)}
            >
              {isOpen ? HIDE : SHOW}
            </Button>
            {isOpen ? (
              <ScrollFade
                className="max-h-40 min-w-0 rounded-sm bg-subtle"
                viewportClassName="max-h-40"
              >
                <pre className="min-w-0 p-2 text-meta whitespace-pre-wrap text-muted-foreground">
                  {full}
                </pre>
              </ScrollFade>
            ) : null}
          </div>
        )
      }
    />
  );
};
