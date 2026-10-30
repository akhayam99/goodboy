import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountBlockedStep } from '../../../../store/slices/workflows/runMount/selectMountBlockedStep';
import type { MountBlockChoice } from '../../../../store/slices/workflows/runMount/resolveMountBlockedStep';
import { RUN_STEP_PIN_COPY } from '../../../workflows/runStepPinCopy';
import { MountBlockPicker } from './MountBlockPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly block: MountBlockedStep;
};

type PickParams = {
  readonly choice: MountBlockChoice;
  readonly key: string;
};

export const OrchestratedMountBlock = ({ sessionId, block }: Props) => {
  const resolveMountBlockedStep = useAppStore((state) => state.resolveMountBlockedStep);
  const reportError = useAppStore((state) => state.reportError);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const isBusy = busyKey !== null;

  const pick = async ({ choice, key }: PickParams): Promise<void> => {
    if (isBusy) {
      return;
    }
    setBusyKey(key);
    try {
      await resolveMountBlockedStep({ sessionId, agentId: block.agentId, choice });
    } catch (error) {
      await reportError({ title: RUN_STEP_PIN_COPY.failed, error, sessionId });
    } finally {
      setBusyKey(null);
    }
  };

  const suggested = block.suggested;

  return (
    <section
      aria-label={RUN_STEP_PIN_COPY.blockTitle({ stepNumber: block.stepNumber })}
      data-mount-blocked-step={block.agentId}
      className="min-w-0"
    >
      <Notice
        tone="warning"
        placement="inline"
        title={RUN_STEP_PIN_COPY.blockTitle({ stepNumber: block.stepNumber })}
        body={RUN_STEP_PIN_COPY.blockBody({ stepNumber: block.stepNumber, branch: block.branch })}
      >
        <div className="flex flex-wrap items-center gap-2">
          {block.isReattachable ? (
            <Button
              size="sm"
              variant="secondary"
              isBusy={busyKey === 'reattach'}
              disabled={isBusy}
              onClick={() => void pick({ choice: { kind: 'reattach' }, key: 'reattach' })}
            >
              {RUN_STEP_PIN_COPY.reattach({ branch: block.branch })}
            </Button>
          ) : null}
          {suggested === null ? null : (
            <Button
              size="sm"
              variant="secondary"
              isBusy={busyKey === 'use'}
              disabled={isBusy}
              onClick={() =>
                void pick({ choice: { kind: 'use', mountId: suggested.mountId }, key: 'use' })
              }
            >
              {RUN_STEP_PIN_COPY.use({ branch: suggested.branch })}
            </Button>
          )}
          {block.choices.length < 2 ? null : (
            <MountBlockPicker
              choices={block.choices}
              isDisabled={isBusy}
              onPick={(mountId) => void pick({ choice: { kind: 'use', mountId }, key: 'pick' })}
            />
          )}
        </div>
      </Notice>
    </section>
  );
};
