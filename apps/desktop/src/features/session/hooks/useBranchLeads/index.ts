import { useCallback, useMemo, useState } from 'react';
import type { Agent, MountId, SessionId, TelemetryRecord } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { liveAutoViewsOf } from '../../../auto/liveAutoViewsOf';
import { branchLeadsOf, type BranchLeads } from '../../branchLeadsOf';
import type { BranchGroup } from '../../branchGroupsOf';
import { agentSpendById } from '../../timeline/agentSpendById';

type Params = {
  readonly sessionId: SessionId;
  readonly group: BranchGroup | null;
  readonly mountId: MountId | null;
  readonly mounts: ReadonlyArray<MountRowView>;
};

export type BranchLeadsModel = BranchLeads &
  Readonly<{
    onToggleFold: (foldId: string) => void;
  }>;

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

export const useBranchLeads = ({ sessionId, group, mountId, mounts }: Params): BranchLeadsModel => {
  const allViews = useAppStore((state) => state.autoTreeViews[sessionId] ?? NO_VIEWS);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const views = useMemo(() => liveAutoViewsOf({ views: allViews, agents }), [agents, allViews]);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  const [openFoldIds, setOpenFoldIds] = useState<ReadonlySet<string>>(new Set());
  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
  const model = useMemo(
    () => branchLeadsOf({ group, mountId, mounts, views, agents, spendByAgentId, openFoldIds }),
    [agents, group, mountId, mounts, openFoldIds, spendByAgentId, views],
  );
  const onToggleFold = useCallback((foldId: string) => {
    setOpenFoldIds((current) => {
      const next = new Set(current);
      if (!next.delete(foldId)) {
        next.add(foldId);
      }
      return next;
    });
  }, []);
  return { ...model, onToggleFold };
};
