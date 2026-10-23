import { formatError, formatUsd, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';
import { useAppStore, useSessionCost } from '../../../../store';
import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { LimitAmountForm } from '../../../../shared/components/SettingChip/LimitAmountForm';
import { useLimitAmountDraft } from '../../../../shared/hooks/useLimitAmountDraft';

type Props = {
  readonly sessionId: SessionId;
};

type WordsParams = {
  readonly capUsd: number | null;
  readonly spentUsd: number;
};

type ApplyParams = {
  readonly usd: number | null;
};

const HELP =
  'What this session may spend, every agent and run in it. Applies when you press Enter or close.';

const CENT = 0.005;

const wordsOf = ({ capUsd, spentUsd }: WordsParams): SettingWords => {
  if (capUsd === null) {
    return {
      value: spentUsd < CENT ? 'none' : `${formatUsd(spentUsd)} spent`,
      source: '',
      chain: 'Session none. Nothing stops this agent.',
    };
  }
  return {
    value: `${formatUsd(spentUsd)} of ${formatUsd(capUsd)}`,
    source: 'from session',
    chain: `Session ${formatUsd(capUsd)}. It counts everything this session spends.`,
  };
};

export const SessionLimitSetting = ({ sessionId }: Props) => {
  const dropdown = useDropdown({ expectedHeight: 240, expectedWidth: 320, width: 'w-80' });
  const budget = useAppStore((state) => state.sessionBudgets[sessionId] ?? null);
  const setSessionBudget = useAppStore((state) => state.setSessionBudget);
  const clearSessionBudget = useAppStore((state) => state.clearSessionBudget);
  const spentUsd = useSessionCost(sessionId);
  const capUsd = budget?.softCapUsd ?? null;

  const apply = async ({ usd }: ApplyParams): Promise<string | null> => {
    try {
      if (usd === null) {
        await clearSessionBudget(sessionId);
        return null;
      }
      await setSessionBudget(sessionId, usd, budget?.onExceed ?? 'pause');
      return null;
    } catch (error) {
      return `Couldn't change it. ${formatError(error)}`;
    }
  };

  const draft = useLimitAmountDraft({
    reportTo: { sessionId },
    currentUsd: capUsd,
    isOpen: dropdown.open,
    failureTitle: "Couldn't change the session limit",
    apply,
  });

  return (
    <SettingChip
      dropdown={dropdown}
      label={NAMES.spendCap}
      words={wordsOf({ capUsd, spentUsd })}
      help={HELP}
      error={draft.error}
    >
      <LimitAmountForm
        label="Limit for this session"
        inputId={`session-limit-${sessionId}`}
        draft={draft}
      />
    </SettingChip>
  );
};
