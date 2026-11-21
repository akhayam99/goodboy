import { Button, Markdown } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';

import { openPlanDrawer } from '../../../../plans/openPlanDrawer';
import { usePlanModel } from '../../../../plans/usePlanModel';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const AskPlanView = ({ sessionId, artifactId }: Props) => {
  const model = usePlanModel({ sessionId, planId: artifactId });
  return (
    <div data-testid="ask-plan" className="flex min-w-0 flex-col gap-3">
      {model === null ? null : (
        <article className="flex min-w-0 flex-col gap-2">
          <p className="text-meta text-faint-foreground">{`Plan · v${model.version}`}</p>
          <h3 className="text-heading text-foreground">{model.plan.title}</h3>
          <Markdown text={model.plan.bodyMd} className="text-prose" />
        </article>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => openPlanDrawer({ sessionId, planId: artifactId })}
      >
        Open plan
      </Button>
    </div>
  );
};
