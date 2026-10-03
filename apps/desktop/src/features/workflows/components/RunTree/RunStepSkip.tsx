import { useState } from 'react';
import { SkipForward } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type RunStepSkipAction = {
  readonly describe: (agent: Agent) => string;
  readonly onSkip: (agent: Agent) => Promise<void>;
};

type Props = {
  readonly agent: Agent;
  readonly skip: RunStepSkipAction;
};

export const RunStepSkip = ({ agent, skip }: Props) => {
  const [isBusy, setIsBusy] = useState(false);

  return (
    <ConfirmPopover
      role="alert"
      icon={<SkipForward size={ICON_SIZE.row} aria-hidden />}
      title={`Skip ${agent.name}?`}
      description={skip.describe(agent)}
      confirmLabel="Skip step"
      cancelLabel="Cancel"
      align="end"
      isBusy={isBusy}
      onConfirm={async () => {
        setIsBusy(true);
        try {
          await skip.onSkip(agent);
        } finally {
          setIsBusy(false);
        }
      }}
      trigger={({ arm }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0"
          disabled={isBusy}
          aria-label={`Skip ${agent.name}`}
          title="Skip this step and move on"
          onClick={arm}
        >
          <SkipForward size={ICON_SIZE.row} aria-hidden />
          Skip
        </Button>
      )}
    />
  );
};
