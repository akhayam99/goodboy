import { formatError, formatUsd, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { tauriDatabase } from '../../../../../shared/lib/db';
import { writeAutoTreeLimit } from '../../../../auto/autoTreeLimit';
import { useAutoTreeLimit } from '../../../../auto/useAutoTreeLimit';
import { LimitAmountForm } from '../../../../../shared/components/SettingChip/LimitAmountForm';
import { SettingChip } from '../../../../../shared/components/SettingChip';
import { useLimitAmountDraft } from '../../../../../shared/hooks/useLimitAmountDraft';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
};

type ApplyParams = {
  readonly usd: number | null;
};

const LABEL = 'Auto limit';

const HELP =
  'What a new Auto and its agents may spend. Empty means no limit. The smaller of this and the session limit pauses it.';

export const DefaultAutoLimitSetting = ({ workspaceId, workspaceName }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 220, expectedWidth: 320, width: 'w-80' });
  const limit = useAutoTreeLimit({ workspaceId }).viewOf({ defaultFrom: 'auto' });
  const loadWorkspaceValue = useAppStore((state) => state.loadWorkspaceValue);
  const reportError = useAppStore((state) => state.reportError);
  const apply = async ({ usd }: ApplyParams): Promise<string | null> => {
    try {
      await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd });
    } catch (error) {
      return `Couldn't change it. ${formatError(error)}`;
    }
    try {
      await loadWorkspaceValue({ workspaceId, key: 'auto.treeLimitUsd' });
    } catch (error) {
      void reportError({
        title: "Saved the Auto limit, but couldn't refresh it",
        error,
        workspaceId,
      });
    }
    return null;
  };
  const draft = useLimitAmountDraft({
    reportTo: { workspaceId },
    currentUsd: limit.usd,
    isOpen: dropdown.open,
    failureTitle: "Couldn't change the Auto limit",
    apply,
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={LABEL}
      words={
        limit.usd === null
          ? {
              value: 'none',
              source: '',
              chain:
                'A new Auto has no limit unless the session has one. An Auto already going keeps its own.',
            }
          : {
              value: formatUsd(limit.usd),
              source: `from ${workspaceName}`,
              chain: `A new Auto starts on ${formatUsd(limit.usd)}, or the session limit when that is smaller. An Auto already going keeps its own.`,
            }
      }
      help={HELP}
      error={draft.error}
    >
      <LimitAmountForm
        label="Limit for a new Auto"
        inputId={`default-auto-limit-${workspaceId}`}
        draft={draft}
        clearLabel="No limit"
      />
    </SettingChip>
  );
};
