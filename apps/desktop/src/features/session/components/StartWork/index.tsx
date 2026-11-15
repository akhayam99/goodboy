import { Button, Chip, FormActions } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { runDefaultLimitOf } from '../../../../store/slices/workflows/runLimit/runDefaultLimitOf';
import type { StartWorkSeed } from '../../../../store/slices/work/state';
import { PromptField } from '../../../../shared/components/PromptField';
import { NAMES } from '../../../../shared/utils/names';
import { AUTO_LIMIT_COPY } from '../../../auto/autoLimitCopy';
import { LeadPermissionsChip } from '../../../auto/permissions/LeadPermissionsChip';
import { StartFailure } from '../StartForm/StartFailure';
import { RunModelChip } from '../StartRun/RunModelChip';
import { StartWorkTargetChips } from './StartWorkTargetChips';
import { useStartWork } from './useStartWork';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly seed: StartWorkSeed;
  readonly onClose: () => void;
};

const LIMIT_TITLE =
  'The Lead and the agents it starts stop at the run default. Change it in Settings.';

const PLACEHOLDER = 'What should the Lead get done?';

const HINT =
  'From Work it starts in a new session. Opened inside a session or on a branch row, it comes with that session and branch filled in.';

export const StartWork = ({ workspaceId, seed, onClose }: Props) => {
  const work = useStartWork({ workspaceId, seed, onStarted: onClose });
  const defaultLimitUsd = useAppStore((state) => runDefaultLimitOf({ state, workspaceId }));
  const hasText = work.text.trim() !== '';
  return (
    <section
      aria-label={NAMES.startWork}
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border-soft p-4"
    >
      <PromptField
        kind="message"
        label={PLACEHOLDER}
        value={work.text}
        onChange={work.setText}
        onSubmit={() => void work.start()}
        isSubmitBlocked={!hasText || work.isStarting}
        placeholder={PLACEHOLDER}
        disabled={work.isStarting}
        minRows={3}
        maxRows={10}
        keyLabels={{ send: 'start' }}
      />
      <div
        role="group"
        aria-label="Where it lands"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        <StartWorkTargetChips
          workspaceId={workspaceId}
          sessionId={work.sessionId}
          projectId={work.projectId}
          branch={work.branch}
          seedBranch={seed.branch}
          isDisabled={work.isStarting}
          onSession={work.setSessionId}
          onProject={work.setProjectId}
          onBranch={work.setBranch}
        />
        <LeadPermissionsChip target={{ workspaceId, sessionId: work.sessionId, treeId: null }} />
        <Chip
          tone="neutral"
          kind="reference"
          label={AUTO_LIMIT_COPY.labelOf({ usd: defaultLimitUsd })}
          title={LIMIT_TITLE}
        />
        <RunModelChip model={work.model} isDisabled={work.isStarting} />
      </div>
      {work.error === null ? null : <StartFailure error={work.error} />}
      <FormActions leading={<p className="min-w-0 text-meta text-faint-foreground">{HINT}</p>}>
        <Button variant="ghost" size="sm" disabled={work.isStarting} onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!hasText || work.isStarting}
          isBusy={work.isStarting}
          busyLabel={NAMES.starting}
          onClick={() => void work.start()}
        >
          {work.error === null ? NAMES.startWork : NAMES.retry}
        </Button>
      </FormActions>
    </section>
  );
};
