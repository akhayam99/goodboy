import { useCallback, useMemo, useState } from 'react';
import type { OpenQuestionId } from '@goodboy/types';
import { useGroupArrival } from '../../../../../../../shared/hooks/useGroupArrival';
import type { QuestionBranchGroup } from '../../questionsLensModel';
import { questionBranchRowKeyOf } from '../questionRowKeys';

type RowParams = {
  readonly rowKey: string;
};

type Params = {
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
  readonly isBranchView: boolean;
  readonly onPickRow: (params: RowParams) => void;
  readonly onArrived: () => void;
};

type ArriveParams = {
  readonly groupKey: string;
};

type ToggleParams = {
  readonly key: string;
};

type RevealParams = {
  readonly questionId: OpenQuestionId;
  readonly fromGroupKey: string;
};

type QuestionsReveal = {
  readonly openGroups: ReadonlySet<string>;
  readonly toggleGroup: (params: ToggleParams) => void;
  readonly revealQuestion: (params: RevealParams) => void;
};

export const useQuestionsReveal = ({
  branchGroups,
  isBranchView,
  onPickRow,
  onArrived,
}: Params): QuestionsReveal => {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const arrivalGroups = useMemo(
    () =>
      branchGroups.map((group) => {
        const first = group.waiting[0] ?? group.answered[0];
        const questionId = first?.row.question.id;
        return {
          key: group.key,
          firstRowKey:
            questionId === undefined
              ? null
              : isBranchView
                ? questionBranchRowKeyOf({ groupKey: group.key, questionId })
                : questionId,
        };
      }),
    [branchGroups, isBranchView],
  );
  const onArrive = useCallback(
    ({ groupKey }: ArriveParams) => {
      setOpenGroups((open) => new Set([...open, groupKey]));
      onArrived();
    },
    [onArrived],
  );
  const { revealRow } = useGroupArrival({
    isActive: true,
    rowAttribute: 'data-row-key',
    groups: arrivalGroups,
    onArrive,
  });

  const toggleGroup = useCallback(({ key }: ToggleParams) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      return new Set([...open, key]);
    });
  }, []);

  const revealQuestion = ({ questionId, fromGroupKey }: RevealParams) => {
    const keys = branchGroups
      .filter((group) =>
        [...group.waiting, ...group.answered].some((item) => item.row.question.id === questionId),
      )
      .map((group) => group.key);
    const groupKey = keys[(keys.indexOf(fromGroupKey) + 1) % keys.length];
    if (groupKey === undefined || groupKey === fromGroupKey) {
      return;
    }
    const rowKey = questionBranchRowKeyOf({ groupKey, questionId });
    setOpenGroups((open) => new Set([...open, groupKey]));
    onPickRow({ rowKey });
    revealRow({ rowKey });
  };

  return { openGroups, toggleGroup, revealQuestion };
};
