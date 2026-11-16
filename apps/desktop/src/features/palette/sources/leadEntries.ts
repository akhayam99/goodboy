import type { AgentId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { WorkRow } from '../../work/workRowsOf';
import type { PaletteEntry } from '../types';

type OpenParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type Params = {
  readonly rows: ReadonlyArray<WorkRow>;
  readonly open: (params: OpenParams) => void;
};

export const leadEntries = ({ rows, open }: Params): ReadonlyArray<PaletteEntry> => {
  const seen = new Set<string>();
  return rows.flatMap((row): ReadonlyArray<PaletteEntry> => {
    if (seen.has(row.treeId)) {
      return [];
    }
    seen.add(row.treeId);
    return [
      {
        key: `lead:${row.treeId}`,
        label: `${NAMES.lead}: ${row.title}`,
        secondary: [NAMES.runKind.run, NAMES.lead, row.sessionGoal],
        kind: 'goto',
        group: null,
        icon: CONCEPT_ICONS.auto,
        detail: row.sessionGoal,
        run: () => open({ sessionId: row.sessionId, agentId: row.rootAgentId }),
      },
    ];
  });
};
