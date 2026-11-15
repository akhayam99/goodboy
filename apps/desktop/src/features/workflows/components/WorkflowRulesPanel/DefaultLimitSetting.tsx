import { useState } from 'react';
import { FieldRow, Input, SegmentedTabs, formatError } from '@goodboy/ui';
import type { WorkflowRules, WorkflowSpendLimitMode, WorkspaceId } from '@goodboy/types';
import { useLimitAmountDraft } from '../../../../shared/hooks/useLimitAmountDraft';
import { NAMES } from '../../../../shared/utils/names';

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

const LABEL = NAMES.spendCap;
const HELP = 'Per new run, saved on Enter. The session limit still applies.';

export const DefaultLimitSetting = ({ workspaceId, rules, patch }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
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
    isOpen: isEditing,
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
  const error = draft.error ?? modeError;
  const stored = rules.spendLimitUsd === null ? '' : String(rules.spendLimitUsd);
  return (
    <FieldRow
      label={LABEL}
      help={
        <>
          {HELP}
          {error === null ? null : (
            <span role="alert" className="text-danger">
              {' '}
              {error}
            </span>
          )}
        </>
      }
    >
      <div className="flex items-center gap-2">
        <form
          aria-label="Limit for new runs"
          onSubmit={(event) => draft.submit({ event })}
          className="flex items-center gap-1"
        >
          <span aria-hidden className="text-meta text-faint-foreground">
            $
          </span>
          <Input
            type="text"
            inputMode="decimal"
            aria-label="Limit in dollars"
            placeholder="None"
            value={isEditing ? draft.amount : stored}
            aria-invalid={draft.isInvalid}
            disabled={draft.isBusy}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            onChange={(event) => draft.setAmount({ amount: event.target.value })}
            className="w-20"
          />
        </form>
        <SegmentedTabs
          size="sm"
          ariaLabel="At the limit"
          options={MODE_OPTIONS}
          value={rules.spendLimitMode}
          onChange={(mode) => void setMode({ mode })}
        />
      </div>
    </FieldRow>
  );
};
