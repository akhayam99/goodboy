import { useRef, useState } from 'react';
import {
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  Switch,
  formatError,
  useDropdown,
} from '@goodboy/ui';
import type { ProviderId, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { NAMES } from '../../../../shared/utils/names';
import { undoable } from '../../../../shared/utils/undoable';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { toggledProviderPool } from '../../providerPool';
import type { RunSettingWords } from './runSettingsOf';
import { SettingChip } from '../../../../shared/components/SettingChip';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly words: RunSettingWords;
};

type ToggleParams = {
  readonly provider: ProviderId;
};

type PoolParams = {
  readonly pool: ReadonlyArray<ProviderId> | null;
};

const HELP = 'Which providers this run may use. A change applies from the next step.';

const keyOf = ({ pool }: PoolParams): string => (pool === null ? '' : [...pool].sort().join(' '));

export const RunModelsSetting = ({ sessionId, run, providers, words }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 220,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  const setWorkflowRunProviderPool = useAppStore((state) => state.setWorkflowRunProviderPool);
  const [error, setError] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const isWritingRef = useRef(false);
  const pool = run.providerPool ?? null;
  const shown = pool ?? providers;

  const write = async ({ pool: next }: PoolParams): Promise<boolean> => {
    setError(null);
    try {
      const outcome = await setWorkflowRunProviderPool({
        sessionId,
        workflowRunId: run.id,
        pool: next,
      });
      return outcome === 'applied';
    } catch (failure) {
      setError(`Couldn't change it. ${formatError(failure)}`);
      return false;
    }
  };

  const currentKey = () => {
    const live = sessionById(useAppStore.getState().sessions, sessionId)?.workflowRuns.find(
      (candidate) => candidate.id === run.id,
    );
    return keyOf({ pool: live?.providerPool ?? null });
  };

  const toggle = async ({ provider }: ToggleParams) => {
    if (isWritingRef.current) {
      return;
    }
    const previous = pool;
    const next = toggledProviderPool({ providers, pool, provider });
    if (keyOf({ pool: next }) === keyOf({ pool: previous })) {
      return;
    }
    isWritingRef.current = true;
    setIsWriting(true);
    let isApplied = false;
    try {
      isApplied = await write({ pool: next });
    } finally {
      isWritingRef.current = false;
      setIsWriting(false);
    }
    if (!isApplied) {
      return;
    }
    undoable({
      message: 'Models changed for this run.',
      conflictMessage: 'The models of this run changed again, so Undo was skipped.',
      isCurrent: () => currentKey() === keyOf({ pool: next }),
      undo: async () => {
        await setWorkflowRunProviderPool({ sessionId, workflowRunId: run.id, pool: previous });
      },
    });
  };

  return (
    <SettingChip dropdown={dropdown} label={NAMES.models} words={words} help={HELP} error={error}>
      <div role="group" aria-label="Providers" className="flex flex-col">
        {providers.map((provider) => (
          <Switch
            key={provider}
            label={PROVIDER_LABEL[provider]}
            ariaLabel={PROVIDER_LABEL[provider]}
            checked={shown.includes(provider)}
            disabled={providers.length < 2 || isWriting}
            onChange={() => void toggle({ provider })}
          />
        ))}
      </div>
    </SettingChip>
  );
};
