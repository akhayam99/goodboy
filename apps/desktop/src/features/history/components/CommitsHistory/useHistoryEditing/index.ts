import { useState } from 'react';
import type { HistoryStep, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  canRemove,
  combineDown,
  resetStep,
  setCombineMode,
  setVerb,
  targetOf,
  type CombineMode,
} from '../../../historyPlan';
import { invertHistoryEdit, type HistoryEdit } from '../../../historyEdits';
import type { HistoryAction } from '../../../historyRowMarks';

export type HistoryArrival = {
  readonly sha: string;
  readonly action: HistoryAction;
  readonly nonce: number;
};

export type HistoryChange = (params: ChangeParams) => void;

type ChangeParams = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly arrive?: { readonly sha: string; readonly action: HistoryAction } | null;
  readonly message: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly original: ReadonlyArray<string>;
  readonly titleOf: (sha: string) => string;
  readonly clearHover: () => void;
};

export const useHistoryEditing = ({
  sessionId,
  mountId,
  items,
  original,
  titleOf,
  clearHover,
}: Params) => {
  const changeLiveHistory = useAppStore((s) => s.changeLiveHistory);
  const [arrival, setArrival] = useState<HistoryArrival | null>(null);
  const [live, setLive] = useState('');

  const change: HistoryChange = ({ items: next, arrive = null, message }) => {
    if (mountId === null) {
      return;
    }
    if (next === items) {
      return;
    }
    const token = useAppStore.getState().historyLiveSessions[mountId]?.token;
    setLive('Editing commit');
    void changeLiveHistory({
      sessionId,
      mountId,
      items: next,
      ...(arrive === null ? {} : { sha: arrive.sha }),
    }).then(() => {
      const completed = useAppStore.getState().historyLiveSessions[mountId];
      if (completed?.token !== token || completed?.isBusy === true || completed === undefined) {
        return;
      }
      if (completed.error !== null) {
        setLive(completed.error);
        return;
      }
      if (arrive !== null) {
        setArrival({ ...arrive, nonce: Date.now() });
      }
      setLive(message);
    });
  };
  const foldDown = ({ sha, mode }: { readonly sha: string; readonly mode: CombineMode }) => {
    const next = combineDown({ items, sha, mode });
    if (next === items) {
      setLive('No commit below');
      return;
    }
    const target =
      targetOf({ step: next.find((step) => step.sha === sha) ?? { sha, verb: 'pick' } }) ?? sha;
    change({
      items: next,
      arrive: { sha: target, action: mode },
      message:
        mode === 'fixup'
          ? `Folded ${titleOf(sha)} into ${titleOf(target)}, keeping its title`
          : `Combined ${titleOf(sha)} with ${titleOf(target)}, both messages kept`,
    });
  };
  const toggleRemove = ({ sha }: { readonly sha: string }) => {
    const step = items.find((candidate) => candidate.sha === sha);
    if (step === undefined) {
      return;
    }
    if (step.verb === 'drop') {
      change({ items: resetStep({ items, sha }), message: `Kept ${titleOf(sha)}` });
      return;
    }
    if (!canRemove({ items, sha })) {
      setLive('Separate the commits squashed into it first');
      return;
    }
    change({
      items: setVerb({ items, sha, verb: 'drop' }),
      arrive: { sha, action: 'drop' },
      message: `Dropped ${titleOf(sha)}`,
    });
  };
  const setMode = ({ sha, mode }: { readonly sha: string; readonly mode: CombineMode }) =>
    change({
      items: setCombineMode({ items, sha, mode }),
      message:
        mode === 'fixup' ? 'Fixup: keeps only the target message' : 'Squash: keeps both messages',
    });
  const separate = ({ sha }: { readonly sha: string }) =>
    change({ items: resetStep({ items, sha }), message: `Separated ${titleOf(sha)}` });
  const undoEdit = (edit: HistoryEdit) => {
    clearHover();
    change({ items: invertHistoryEdit({ items, original, edit }), message: 'Undone' });
  };

  return { arrival, live, setLive, change, foldDown, toggleRemove, setMode, separate, undoEdit };
};
