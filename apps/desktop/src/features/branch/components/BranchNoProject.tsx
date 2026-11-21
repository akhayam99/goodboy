import { EmptyState, PageColumn } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { mountProjectActionRegistration } from '../../session/mountProjectActionRegistration';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly size: 'page' | 'section';
  readonly thing: 'commits' | 'files';
};

export const BranchNoProject = ({ sessionId, workspaceId, size, thing }: Props) => (
  <PageColumn width="column">
    <EmptyState
      size={size}
      tone={CONCEPT_TONE.diff}
      icon={CONCEPT_ICONS.diff}
      title="No branch in this session"
      description={`Add a project to see its ${thing}.`}
      action={mountProjectActionRegistration.render({ sessionId, workspaceId })}
    />
  </PageColumn>
);
