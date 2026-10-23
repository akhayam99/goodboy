import { formatUsd, useDropdown } from '@goodboy/ui';
import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';
import { undoable } from '../../../../shared/utils/undoable';
import { useAppStore } from '../../../../store';
import { autoLimitOpenEvent } from '../../../auto/chat/autoLimitOpenEvent';
import { useAutoTreeCap } from '../../../auto/chat/useAutoTreeCap';
import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { LimitAmountForm } from '../../../../shared/components/SettingChip/LimitAmountForm';
import { useLimitAmountDraft } from '../../../../shared/hooks/useLimitAmountDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly facts: AutoBudgetFacts;
  readonly sessionCapUsd: number | null;
  readonly words: SettingWords;
};

type ApplyParams = {
  readonly usd: number | null;
};

const HELP =
  'What this Auto and the agents it starts may spend. The smallest limit pauses it. Applies when you press Enter or close.';

export const AutoLimitSetting = ({ sessionId, treeId, facts, sessionCapUsd, words }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 240,
    expectedWidth: 320,
    width: 'w-80',
    openEvent: autoLimitOpenEvent({ treeId }),
  });
  const save = useAutoTreeCap({ sessionId, treeId });
  const turns = useAppStore(
    (state) =>
      (state.autoTreeViews[sessionId] ?? []).find((view) => view.tree.id === treeId)?.tree
        .turnsUsed ?? 0,
  );
  const capOf = (): number | null =>
    (useAppStore.getState().autoTreeViews[sessionId] ?? []).find((view) => view.tree.id === treeId)
      ?.budget?.capUsd ?? null;

  const apply = async ({ usd }: ApplyParams): Promise<string | null> => {
    const isOverSession = sessionCapUsd !== null && (usd === null || usd > sessionCapUsd);
    if (isOverSession) {
      return `The session limit is ${formatUsd(sessionCapUsd)} and comes first. Raise it first.`;
    }
    const previous = facts.capUsd;
    const failure = await save({ expectedCapUsd: previous, capUsd: usd });
    if (failure !== null) {
      return failure;
    }
    undoable({
      message: 'Auto limit changed.',
      conflictMessage: 'The Auto limit changed again, so Undo was skipped.',
      isCurrent: () => capOf() === usd,
      undo: async () => {
        const undone = await save({ expectedCapUsd: usd, capUsd: previous });
        if (undone !== null) {
          throw new Error(undone);
        }
      },
    });
    return null;
  };

  const draft = useLimitAmountDraft({
    reportTo: { sessionId },
    currentUsd: facts.capUsd,
    isOpen: dropdown.open,
    failureTitle: "Couldn't change the Auto limit",
    apply,
  });

  return (
    <SettingChip
      dropdown={dropdown}
      label={NAMES.spendCap}
      words={words}
      help={HELP}
      error={draft.error}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-meta tabular-nums">
        <dt className="text-muted-foreground">Spent</dt>
        <dd className="text-right text-foreground">{formatUsd(facts.spentUsd)}</dd>
        <dt className="text-muted-foreground">Reserved</dt>
        <dd className="text-right text-foreground">{formatUsd(facts.reservedUsd)}</dd>
        {turns === 0 ? null : (
          <>
            <dt className="text-muted-foreground">Turns</dt>
            <dd className="text-right text-foreground">{turns}</dd>
          </>
        )}
      </dl>
      <LimitAmountForm label="Limit for this Auto" inputId={`auto-limit-${treeId}`} draft={draft} />
    </SettingChip>
  );
};
