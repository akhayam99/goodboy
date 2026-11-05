import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, tintClasses } from '@goodboy/ui';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';
import { AUTO_STATE_TONE } from './autoStateTone';
import { focusAgentComposer } from './focusAgentComposer';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: string;
  readonly title: string;
  readonly onOpen: (artifactId: string) => void;
};

const SETTLED_COPY = {
  revising: ' · changes asked',
  approved: ' approved',
  used: ' used',
  not_needed: ' · no approval needed',
} as const;

export const AutoDockPlan = ({ sessionId, artifactId, title, onOpen }: Props) => {
  const model = useAutoPlanApproval({
    sessionId,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
  });
  if (model === null) {
    return null;
  }
  const state = model.approval.state;
  const openPlan = (
    <Button
      variant="quiet"
      size="xs"
      aria-label={`Open plan ${title}`}
      onClick={() => onOpen(artifactId)}
    >
      Open plan
    </Button>
  );
  if (state === 'needs_approval') {
    return (
      <div
        data-dock-plan={state}
        className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
      >
        <span className={tintClasses(AUTO_STATE_TONE.waitingOnYou).text}>
          Plan v{model.version} waits for your OK
        </span>
        <span className="flex-1" />
        <Button
          variant="quiet"
          size="xs"
          onClick={() => {
            model.askForChanges();
            requestAnimationFrame(focusAgentComposer);
          }}
        >
          Ask for changes
        </Button>
        {openPlan}
        <Button
          variant="primary"
          size="sm"
          disabled={model.isBusy}
          onClick={() => void model.approve()}
        >
          Approve plan
        </Button>
      </div>
    );
  }
  return (
    <div
      data-dock-plan={state}
      className="flex min-h-7 min-w-0 items-center gap-2 text-meta text-muted-foreground"
    >
      <span
        data-tone={state === 'approved' ? AUTO_STATE_TONE.artifact : undefined}
        className={state === 'approved' ? tintClasses(AUTO_STATE_TONE.artifact).text : undefined}
      >
        Plan v{model.version}
        {SETTLED_COPY[state]}
      </span>
      <span className="flex-1" />
      {openPlan}
    </div>
  );
};
