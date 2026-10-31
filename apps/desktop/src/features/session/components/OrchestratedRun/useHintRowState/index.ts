import { useContext, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { WorkflowRunId } from '@goodboy/types';
import { HintRowStateContext, type HintRowViewState } from '../HintRowStateContext';

type Params = {
  readonly runId: WorkflowRunId;
  readonly hintId: string;
};

type HintRowState = HintRowViewState & {
  readonly rowRef: RefObject<HTMLDivElement | null>;
  readonly setIsExpanded: (params: ExpandedParams) => void;
  readonly setOpenImageId: (params: OpenIdParams) => void;
};

type ExpandedParams = {
  readonly isExpanded: boolean;
};

type OpenIdParams = {
  readonly openId: string | null;
};

type PatchParams = {
  readonly next: Partial<HintRowViewState>;
};

const CLOSED: HintRowViewState = { isExpanded: false, openImageId: null };

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

export const useHintRowState = ({ runId, hintId }: Params): HintRowState => {
  const shared = useContext(HintRowStateContext);
  const [local, setLocal] = useState<HintRowViewState>(CLOSED);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const key = `${runId}:${hintId}`;
  const current = shared === null ? local : (shared.rows[key] ?? CLOSED);
  const focusMark = shared?.focusMark ?? null;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (focusMark === null || row === null) {
      return;
    }
    const mark = focusMark.current;
    if (mark?.key === key) {
      focusMark.current = null;
      const control =
        mark.control === null
          ? null
          : row.querySelector<HTMLElement>(`[data-hint-control="${mark.control}"]`);
      (control ?? row.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }
    return () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && row.contains(active)) {
        focusMark.current = { key, control: active.dataset['hintControl'] ?? null };
      }
    };
  }, [focusMark, key]);

  const patch = ({ next }: PatchParams) => {
    if (shared === null) {
      setLocal((state) => ({ ...state, ...next }));
      return;
    }
    shared.patch({ key, patch: next });
  };

  return {
    ...current,
    rowRef,
    setIsExpanded: ({ isExpanded }: ExpandedParams) => patch({ next: { isExpanded } }),
    setOpenImageId: ({ openId }: OpenIdParams) => patch({ next: { openImageId: openId } }),
  };
};
