import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { PLAN_REVISING_REASON } from '../../plans/planRevising';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';
import type { ArtifactLinkModel } from './artifactLinksOf';
import { focusAgentComposer } from './focusAgentComposer';

type Props = {
  readonly sessionId: SessionId;
  readonly link: ArtifactLinkModel;
  readonly onOpen: (artifactId: string) => void;
};

export const AutoPlanAsk = ({ sessionId, link, onOpen }: Props) => {
  const model = useAutoPlanApproval({
    sessionId,
    artifactId: brandId<ArtifactId>({ value: link.artifactId }),
  });
  if (model === null || model.approval.state === 'approved') {
    return null;
  }
  const isRevising = model.approval.state === 'revising';
  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`Plan v${model.version} needs your approval`}
      body={
        <Button
          variant="quiet"
          size="xs"
          aria-label={`Open plan ${link.title}`}
          onClick={() => onOpen(link.artifactId)}
        >
          {link.title}
        </Button>
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              model.askForChanges();
              focusAgentComposer();
            }}
          >
            Ask for changes
          </Button>
          <Button
            size="sm"
            disabled={isRevising || model.isBusy}
            isBusy={model.isBusy}
            busyLabel="Approving"
            title={isRevising ? PLAN_REVISING_REASON : undefined}
            onClick={() => void model.approve()}
          >
            Approve plan
          </Button>
        </>
      }
    />
  );
};
