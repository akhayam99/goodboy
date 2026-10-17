import { useState } from 'react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ResolvedAction, WorkflowRunActionTarget } from '../../../actions/types';
import { RUN_LIVE_VERB_IDS } from './runLiveVerbIds';

type Props = {
  readonly target: WorkflowRunActionTarget;
};

type PressParams = {
  readonly action: ResolvedAction;
};

export const RunLiveVerbs = ({ target }: Props) => {
  const env = useActionEnv({
    origin: 'button',
    anchorKey: `workflow-run-live:${target.runId}`,
    viewing: { kind: 'workflowRun', id: target.runId },
  });
  const { actions, run } = useObjectActions({ target, env });
  const reportError = useAppStore((state) => state.reportError);
  const [busyId, setBusyId] = useState<string | null>(null);
  const verbs = RUN_LIVE_VERB_IDS.flatMap((id) => {
    const action = actions.find((candidate) => candidate.id === id);
    return action === undefined ? [] : [action];
  });
  if (verbs.length === 0) {
    return null;
  }

  const press = async ({ action }: PressParams) => {
    if (busyId !== null) {
      return;
    }
    setBusyId(action.id);
    try {
      await run({ actionId: action.id });
    } catch (error) {
      await reportError({
        title: `Couldn't ${action.label.toLowerCase()}`,
        error,
        sessionId: target.sessionId,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-run-live-verbs="" className="flex shrink-0 items-center gap-2">
      {verbs.map((action) => {
        const isBusy = busyId === action.id;
        const content = (
          <>
            <action.icon size={ICON_SIZE.control} aria-hidden />
            {action.label}
          </>
        );
        const confirm = action.confirm;
        if (confirm === null) {
          return (
            <Button
              key={action.id}
              size="sm"
              variant="secondary"
              data-run-verb={action.id}
              isBusy={isBusy}
              disabled={action.blockedReason !== null}
              onClick={() => void press({ action })}
            >
              {content}
            </Button>
          );
        }
        return (
          <ConfirmPopover
            key={action.id}
            role={confirm.role}
            icon={<action.icon size={ICON_SIZE.control} aria-hidden />}
            title={confirm.title}
            description={confirm.description}
            confirmLabel={confirm.confirmLabel}
            isBusy={isBusy}
            onConfirm={() => void press({ action })}
            trigger={({ arm }) => (
              <Button
                size="sm"
                variant="secondary"
                data-run-verb={action.id}
                isBusy={isBusy}
                disabled={action.blockedReason !== null}
                onClick={arm}
              >
                {content}
              </Button>
            )}
          />
        );
      })}
    </div>
  );
};
