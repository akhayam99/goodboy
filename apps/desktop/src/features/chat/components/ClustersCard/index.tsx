import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { extractClustersFromMarker } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { MARKER_ACCENT } from '../marker-accents';
import { SpawnTree } from '../../../orchestration/components/SpawnTree';
import { clusterLinksToNodes } from '../../../orchestration/hooks/useSpawnTree';
import { selectInlineClusterRuns } from '../ChatView/clusterDashboard';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

const accent = MARKER_ACCENT.clusters;

export const ClustersCard = ({ assistantText, sessionId }: Props) => {
  const clusters = useMemo(() => extractClustersFromMarker(assistantText), [assistantText]);
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const selectAgent = useAppStore((s) => s.selectAgent);

  const links = useMemo(
    () => (clusters ? selectInlineClusterRuns(phaseRuns, selectedAgentId, clusters) : []),
    [clusters, phaseRuns, selectedAgentId],
  );

  const nodes = useMemo(
    () => clusterLinksToNodes(links, selectedAgentId),
    [links, selectedAgentId],
  );

  if (!clusters || clusters.length === 0) {
    return null;
  }

  const onSelect = (id: AgentId) => {
    void selectAgent(sessionId, id);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <div
      className={`mt-2 rounded-lg border ${accent.border} ${accent.bg} px-3 py-2`}
      data-testid="clusters-card"
    >
      <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-medium ${accent.text}`}>
        <Layers size={12} aria-hidden />
        <span>
          {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
        </span>
      </div>
      <SpawnTree variant="inline" nodes={nodes} onSelect={onSelect} />
    </div>
  );
};
