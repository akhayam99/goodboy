import { useEffect, useMemo, useRef } from 'react';
import type { OpenQuestionId } from '@goodboy/types';
import type { QuestionBranchGroup, QuestionGroups } from '../../questionsLensModel';
import { questionBranchRowKeyOf } from '../questionRowKeys';

type Params = {
  readonly groups: QuestionGroups;
  readonly branchGroups: ReadonlyArray<QuestionBranchGroup>;
  readonly isBranchView: boolean;
  readonly selectedId: OpenQuestionId | null;
};

export const useFocusFirstWaiting = ({
  groups,
  branchGroups,
  isBranchView,
  selectedId,
}: Params) => {
  const hasFocusedFirst = useRef(false);
  const firstWaitingId = groups.waiting[0]?.question.id ?? null;
  const firstWaitingKey = useMemo(() => {
    if (!isBranchView) {
      return firstWaitingId;
    }
    const firstGroup = branchGroups.find((group) => group.waiting.length > 0);
    const firstItem = firstGroup?.waiting[0];
    return firstGroup === undefined || firstItem === undefined
      ? null
      : questionBranchRowKeyOf({ groupKey: firstGroup.key, questionId: firstItem.row.question.id });
  }, [isBranchView, firstWaitingId, branchGroups]);

  useEffect(() => {
    if (hasFocusedFirst.current) {
      return;
    }
    hasFocusedFirst.current = true;
    if (firstWaitingKey === null || selectedId !== null) {
      return;
    }
    const first = [...document.querySelectorAll<HTMLElement>('[data-list-grid-row]')].find(
      (element) => element.getAttribute('data-row-key') === firstWaitingKey,
    );
    if (first === undefined) {
      return;
    }
    const active = document.activeElement;
    const layer = first.closest('[data-pane-layer]');
    const isPaneTitle = active instanceof HTMLHeadingElement && layer?.contains(active) === true;
    if (active !== null && active !== document.body && !isPaneTitle) {
      return;
    }
    first.focus();
  }, [firstWaitingKey, selectedId]);
};
