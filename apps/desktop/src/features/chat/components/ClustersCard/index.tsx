import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { extractClustersFromMarker } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';
import { SpawnedAgentList, type SpawnedAgentItem } from '../SpawnedAgentList';
import { selectInlineClusterRuns } from '../ChatView/clusterDashboard';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

const accent = MARKER_ACCENT.merged;

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

  if (!clusters || clusters.length === 0) {
    return null;
  }

  const total = links.length;
  const items: ReadonlyArray<SpawnedAgentItem> = links.map((link, i) => ({
    key: link.agent?.id ?? `cluster-${i}`,
    index: i,
    total,
    name: link.agent?.name ?? link.title,
    body:
      link.agent && link.agent.status === 'completed'
        ? (link.agent.outputSummary ?? link.instructions)
        : link.instructions,
    status: link.agent ? link.agent.status : 'planned',
    agentId: link.agent?.id ?? null,
  }));

  const onSelect = (id: AgentId) => {
    void selectAgent(sessionId, id);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <TranscriptShell tone="merged" variant="boxed" emphasis className="mt-2">
      <div data-testid="clusters-card">
        <div className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium ${accent.text}`}>
          <Layers size={12} aria-hidden />
          <span>
            {clusters.length} cluster{clusters.length !== 1 ? 's' : ''}
          </span>
        </div>
        <SpawnedAgentList
          items={items}
          selectedAgentId={selectedAgentId ?? undefined}
          onSelect={onSelect}
          variant="inline"
        />
      </div>
    </TranscriptShell>
  );
};
