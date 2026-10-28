import { useCallback, useMemo, useState } from 'react';
import type { Workflow } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../../store';
import { parseQuery } from '../../../../quick-actions/grammar';
import { buildWorkflowActions } from '../../../../quick-actions/registry';
import type { QuickActionItem } from '../../../../quick-actions/types';
import { agentKindPalette, visibleAgentKinds } from '../../../agent-kind';
import type { RunAs } from '../../../startRun/runAsOf';
import { RUN_ROUTE_COPY } from '../../../startRun/runRouteCopy';

type Params = {
  readonly text: string;
  readonly presets: ReadonlyArray<Workflow>;
  readonly setText: (text: string) => void;
  readonly onPick: (runAs: RunAs) => void;
};

const PREFIX_ONLY = /^\s*[~@][^\s]*$/;

const EMPTY_HINT: Readonly<Record<string, string>> = {
  '~': RUN_ROUTE_COPY.runAs.emptyPresets,
  '@': 'No role matches.',
};

type RoleItemsParams = {
  readonly pick: (runAs: RunAs) => void;
};

const roleItems = ({ pick }: RoleItemsParams): ReadonlyArray<QuickActionItem> =>
  visibleAgentKinds()
    .filter((kind) => kind !== 'auto')
    .map((kind): QuickActionItem => ({
      id: `role:${kind}`,
      label: agentKindPalette({ kind }).label,
      group: 'agent',
      perform: () => pick({ kind: 'role', role: kind }),
    }));

export const useRunPrefixMenu = ({ text, presets, setText, onPick }: Params) => {
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuery(text), [text]);
  const symbol = parsed.prefix?.symbol;
  const isPrefix = PREFIX_ONLY.test(text) && (symbol === '~' || symbol === '@');

  const pick = useCallback(
    (runAs: RunAs): void => {
      setText('');
      setDismissedText(null);
      onPick(runAs);
    },
    [onPick, setText],
  );

  const items = useMemo<ReadonlyArray<QuickActionItem>>(() => {
    if (!isPrefix) {
      return EMPTY_ARRAY;
    }
    const all =
      symbol === '~'
        ? buildWorkflowActions(presets, (preset) => pick({ kind: 'preset', presetId: preset.id }))
        : roleItems({ pick });
    const query = parsed.query.toLowerCase();
    return query === '' ? all : all.filter((item) => item.label.toLowerCase().includes(query));
  }, [isPrefix, parsed.query, pick, presets, symbol]);

  const dismiss = useCallback(() => setDismissedText(text), [text]);
  const onSelect = useCallback((item: QuickActionItem) => item.perform(), []);

  return {
    isOpen: isPrefix && dismissedText !== text,
    items,
    emptyHint: EMPTY_HINT[symbol ?? ''] ?? '',
    dismiss,
    onSelect,
  };
};
