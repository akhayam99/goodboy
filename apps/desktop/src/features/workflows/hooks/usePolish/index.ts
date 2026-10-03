import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useToast } from '../../../../shared/components/Toast';

type PolishEntry = {
  readonly previous: string;
  readonly polished: string;
};

type Params = {
  readonly onError: (message: string) => void;
};

type PolishRunParams = {
  readonly id: string;
  readonly current: string;
  readonly keptMessage: string;
  readonly polish: () => Promise<string | null>;
  readonly apply: (text: string) => void;
};

type FieldParams = {
  readonly id: string;
  readonly current: string;
};

type UndoParams = FieldParams & {
  readonly apply: (text: string) => void;
};

export type Polish = {
  readonly polishingId: string | null;
  readonly run: (params: PolishRunParams) => Promise<void>;
  readonly canUndo: (params: FieldParams) => boolean;
  readonly undo: (params: UndoParams) => void;
};

export const usePolish = ({ onError }: Params): Polish => {
  const { showToast } = useToast();
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Readonly<Record<string, PolishEntry>>>({});

  const run = async ({ id, current, keptMessage, polish, apply }: PolishRunParams) => {
    if (current.trim() === '' || polishingId !== null) {
      return;
    }
    setPolishingId(id);
    try {
      const polished = await polish();
      if (polished === null || polished.trim() === '') {
        showToast({ kind: 'warning', message: keptMessage });
        return;
      }
      if (polished === current) {
        return;
      }
      setEntries((previous) => ({ ...previous, [id]: { previous: current, polished } }));
      apply(polished);
    } catch (error) {
      onError(formatError(error));
    } finally {
      setPolishingId(null);
    }
  };

  const canUndo = ({ id, current }: FieldParams): boolean => entries[id]?.polished === current;

  const undo = ({ id, current, apply }: UndoParams) => {
    const entry = entries[id];
    if (entry === undefined || entry.polished !== current) {
      return;
    }
    setEntries((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id)),
    );
    apply(entry.previous);
  };

  return { polishingId, run, canUndo, undo };
};
