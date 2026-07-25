import { useState } from 'react';
import { Divider } from '@goodboy/ui';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { AgentsSection } from '../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection';
import { ResolverInspector } from '../../ResolverInspector';
import { PaneShell } from './PaneShell';

type Props = {
  readonly session: Session;
  readonly meta: string | undefined;
};

export const ResolvePane = ({ session, meta }: Props) => {
  const sessionId = session.id as SessionId;
  const [inspectedId, setInspectedId] = useState<AgentId | null>(null);

  return (
    <div className="flex h-full min-h-0">
      <div className="min-h-0 flex-1">
        <PaneShell
          title="Resolve"
          description="Resolver agents spawned from pull request comments and diff selections."
          meta={meta}
          width="3xl"
        >
          <AgentsSection
            task={session}
            only="resolve"
            inspectedResolverId={inspectedId}
            onInspectResolver={(agentId) =>
              setInspectedId((prev) => (prev === agentId ? null : agentId))
            }
          />
        </PaneShell>
      </div>
      {inspectedId !== null ? (
        <>
          <Divider orientation="vertical" />
          <ResolverInspector
            sessionId={sessionId}
            agentId={inspectedId}
            onClose={() => setInspectedId(null)}
          />
        </>
      ) : null}
    </div>
  );
};
