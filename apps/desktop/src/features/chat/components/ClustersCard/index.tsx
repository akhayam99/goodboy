import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { extractClustersFromMarker } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { tintClasses } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';
import {
  SpawnedAgentList,
  type SpawnedAgentItem,
} from '../../../../shared/components/SpawnedAgentList';
import { clusterBody } from './clusterBody';
import { selectInlineClusterRuns } from './selectInlineClusterRuns';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

const accent = tintClasses('primary');

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
    body: clusterBody({ agent: link.agent ?? null, instructions: link.instructions }),
    status: link.agent ? link.agent.status : 'planned',
    agentId: link.agent?.id ?? null,
  }));

  const onSelect = (id: AgentId) => {
    void selectAgent(sessionId, id);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  return (
    <TranscriptShell tone="neutral" variant="boxed">
      <div data-testid="clusters-card" className="flex flex-col gap-1.5">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${accent.text}`}>
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
