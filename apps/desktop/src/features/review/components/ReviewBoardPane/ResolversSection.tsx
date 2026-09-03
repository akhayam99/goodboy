import { useMemo } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { cn, Divider, LensEmptyState, PANE_RHYTHM, ScrollFade, SectionHeader } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ResolverAgentsLane } from '../../../session/components/ResolverAgentsLane';
import { resolverLaneEntries } from '../../../session/components/ResolverAgentsLane/resolverLaneEntries';
import { useResolverIndex } from '../../../session/hooks/useResolverIndex';

type Props = {
  readonly session: Session;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId) => void;
};

export const ResolversSection = ({ session, inspectedResolverId, onInspectResolver }: Props) => {
  const resolverIndex = useResolverIndex(session.id);
  const entries = useMemo(
    () => resolverLaneEntries({ links: resolverIndex.links }),
    [resolverIndex.links],
  );

  return (
    <ScrollFade className="min-h-0 flex-1">
      <div className={cn(PANE_RHYTHM.stack, PANE_RHYTHM.body)}>
        <section aria-label="Active resolvers" className="flex flex-col gap-2">
          <SectionHeader
            label="Active"
            hint={
              entries.active.length === 0
                ? undefined
                : `${entries.active.length} resolver${entries.active.length === 1 ? '' : 's'} in flight`
            }
          />
          <ResolverAgentsLane
            session={session}
            mode="active"
            inspectedResolverId={inspectedResolverId}
            onInspectResolver={onInspectResolver}
          />
          {entries.active.length === 0 ? (
            <LensEmptyState
              tone={CONCEPT_TONE.resolve}
              icon={CONCEPT_ICONS.resolve}
              title="No active resolvers"
              description="Spawn one from an open review thread or a diff selection."
            />
          ) : null}
        </section>
        <Divider />
        <section aria-label="Finished resolvers" className="flex flex-col gap-2">
          <SectionHeader
            label="Finished"
            hint={
              entries.completed.length === 0 ? undefined : `${entries.completed.length} settled`
            }
          />
          <ResolverAgentsLane
            session={session}
            mode="finished"
            inspectedResolverId={inspectedResolverId}
            onInspectResolver={onInspectResolver}
          />
          {entries.completed.length === 0 ? (
            <LensEmptyState
              tone={CONCEPT_TONE.resolve}
              icon={CONCEPT_ICONS.resolve}
              title="Nothing settled yet"
              description="Resolved and closed-off resolvers land here for reference."
            />
          ) : null}
        </section>
      </div>
    </ScrollFade>
  );
};
