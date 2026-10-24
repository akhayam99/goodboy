import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
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
  if (isRevising) {
    return (
      <p className="flex min-w-0 items-center gap-2 text-ui text-muted-foreground">
        <Button
          variant="quiet"
          size="xs"
          aria-label={`Open plan ${link.title}`}
          onClick={() => onOpen(link.artifactId)}
        >
          Plan v{model.version}
        </Button>
        <span>· changes asked</span>
      </p>
    );
  }
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
            data-demo-anchor="auto-approve"
            disabled={model.isBusy}
            isBusy={model.isBusy}
            busyLabel="Approving"
            onClick={() => void model.approve()}
          >
            Approve plan
          </Button>
        </>
      }
    />
  );
};
