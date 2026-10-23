import { formatError, formatUsd, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { tauriDatabase } from '../../../../shared/lib/db';
import { autoTreeLimitKey, writeAutoTreeLimit } from '../../../auto/autoTreeLimit';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { LimitAmountForm } from '../../../../shared/components/SettingChip/LimitAmountForm';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { useLimitAmountDraft } from '../../../../shared/hooks/useLimitAmountDraft';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
};

type ApplyParams = {
  readonly usd: number | null;
};

const LABEL = 'Auto limit';

const HELP =
  'What a new Auto and its agents may spend. The smaller of this and the session limit pauses it.';

export const DefaultAutoLimitSetting = ({ workspaceId, workspaceName }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 220, expectedWidth: 320, width: 'w-80' });
  const limit = useAutoTreeLimit({ workspaceId });
  const loadSetting = useAppStore((state) => state.loadSetting);
  const apply = async ({ usd }: ApplyParams): Promise<string | null> => {
    if (usd === null) {
      return 'A new Auto always starts with a limit. Enter an amount over zero.';
    }
    try {
      await writeAutoTreeLimit({ db: tauriDatabase, workspaceId, usd });
      await loadSetting(autoTreeLimitKey({ workspaceId }));
      return null;
    } catch (error) {
      return `Couldn't change it. ${formatError(error)}`;
    }
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
      words={{
        value: formatUsd(limit.usd),
        source: limit.isStored ? `from ${workspaceName}` : 'default',
        chain: `A new Auto starts on ${formatUsd(limit.usd)}, or the session limit when that is smaller. An Auto already going keeps its own.`,
      }}
      help={HELP}
      error={draft.error}
    >
      <LimitAmountForm
        label="Limit for a new Auto"
        inputId={`default-auto-limit-${workspaceId}`}
        draft={draft}
      />
    </SettingChip>
  );
};
