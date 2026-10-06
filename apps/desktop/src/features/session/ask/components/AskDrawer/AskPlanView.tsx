import { ChevronLeft } from 'lucide-react';
import { Button, Markdown, useEscapeLayer } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { usePlanModel } from '../../../../plans/usePlanModel';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly onBack: () => void;
};

export const AskPlanView = ({ sessionId, artifactId, onBack }: Props) => {
  const model = usePlanModel({ sessionId, planId: artifactId });
  useEscapeLayer(onBack);
  const navigate = useAppStore((state) => state.navigate);
  const openInArtifacts = () =>
    navigate({
      to: sessionPlace({ sessionId, lens: 'plans', target: { kind: 'artifact', artifactId } }),
    });
  return (
    <div data-testid="ask-plan" className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-6 items-center gap-1 self-start rounded-md pl-1 pr-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ChevronLeft size={ICON_SIZE.row} aria-hidden />
        Back to answer
      </button>
      {model === null ? null : (
        <article className="flex min-w-0 flex-col gap-2">
          <p className="text-meta text-faint-foreground">{`Plan · v${model.version}`}</p>
          <h3 className="text-heading text-foreground">{model.plan.title}</h3>
          <Markdown text={model.plan.bodyMd} className="text-prose" />
        </article>
      )}
      <Button variant="secondary" size="sm" className="self-start" onClick={openInArtifacts}>
        Open in Artifacts
      </Button>
    </div>
  );
};
