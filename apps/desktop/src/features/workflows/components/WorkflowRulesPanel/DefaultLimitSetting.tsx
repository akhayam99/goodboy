import { useState } from 'react';
import { SegmentedTabs, formatError, formatUsd, useDropdown } from '@goodboy/ui';
import type { WorkflowRules, WorkflowSpendLimitMode, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';
import { LimitAmountForm } from '../../../../shared/components/SettingChip/LimitAmountForm';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { useLimitAmountDraft } from '../../../../shared/hooks/useLimitAmountDraft';

type PatchRules = (next: Partial<WorkflowRules>) => Promise<void>;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rules: WorkflowRules;
  readonly patch: PatchRules;
};

type ApplyParams = {
  readonly usd: number | null;
};

type ModeParams = {
  readonly mode: WorkflowSpendLimitMode;
};

const MODE_OPTIONS = [
  { value: 'pause', label: 'Pause' },
  { value: 'notify', label: 'Warn only' },
] as const;

const HELP =
  'What a new run may spend. Applies when you press Enter or close; runs already going keep theirs.';

export const DefaultLimitSetting = ({ workspaceId, rules, patch }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 260, expectedWidth: 320, width: 'w-80' });
  const [modeError, setModeError] = useState<string | null>(null);
  const apply = async ({ usd }: ApplyParams): Promise<string | null> => {
    try {
      await patch({ spendLimitUsd: usd });
      return null;
    } catch (error) {
      return `Couldn't change it. ${formatError(error)}`;
    }
  };
  const draft = useLimitAmountDraft({
    reportTo: { workspaceId },
    currentUsd: rules.spendLimitUsd,
    isOpen: dropdown.open,
    failureTitle: "Couldn't change the limit for new runs",
    apply,
  });
  const setMode = async ({ mode }: ModeParams) => {
    setModeError(null);
    try {
      await patch({ spendLimitMode: mode });
    } catch (error) {
      setModeError(`Couldn't change it. ${formatError(error)}`);
    }
  };
  const value = rules.spendLimitUsd === null ? 'none' : formatUsd(rules.spendLimitUsd);
  return (
    <SettingChip
      dropdown={dropdown}
      label={NAMES.spendCap}
      words={{
        value,
        source: 'new runs',
        chain: `New runs start with ${value}, then the session limit. Each run keeps its own copy.`,
      }}
      help={HELP}
      error={draft.error ?? modeError}
    >
      <LimitAmountForm
        label="Limit for new runs"
        inputId={`default-run-limit-${workspaceId}`}
        draft={draft}
      />
      <SegmentedTabs
        fill
        size="xs"
        ariaLabel="At the limit"
        options={MODE_OPTIONS}
        value={rules.spendLimitMode}
        onChange={(mode) => void setMode({ mode })}
      />
    </SettingChip>
  );
};
