import { useShallow } from 'zustand/react/shallow';
import type { TurnState } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { WorkLead } from '../../../store/slices/work/state';

type Params = {
  readonly leads: ReadonlyArray<WorkLead>;
};

export const useRootTurns = ({ leads }: Params): Readonly<Record<string, TurnState | undefined>> =>
  useAppStore(
    useShallow((state) =>
      Object.fromEntries(
        leads.map((lead) => [
          lead.view.tree.rootAgentId,
          state.agentTurnState[lead.view.tree.rootAgentId],
        ]),
      ),
    ),
  );
