import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';
import type { ArtifactLinkModel } from './artifactLinksOf';
import { AutoPlanOutline } from './AutoPlanOutline';

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
  if (model === null) {
    return null;
  }
  const viewPlan = (
    <Button
      variant={model.approval.state === 'needs_approval' ? 'primary' : 'quiet'}
      size={model.approval.state === 'needs_approval' ? 'sm' : 'xs'}
      aria-label={`Open plan ${link.title}`}
      onClick={() => onOpen(link.artifactId)}
    >
      View plan
    </Button>
  );
  if (model.approval.state === 'approved') {
    return null;
  }
  if (model.approval.state === 'revising') {
    return (
      <p className="flex min-w-0 items-center gap-2 text-ui text-muted-foreground">
        <span>Plan v{model.version} · changes asked</span>
        {viewPlan}
      </p>
    );
  }
  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`Plan v${model.version} needs your approval`}
      body={
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-foreground">{link.title}</p>
          {model.outline === null ? null : <AutoPlanOutline outline={model.outline} />}
        </div>
      }
      actions={viewPlan}
    />
  );
};
