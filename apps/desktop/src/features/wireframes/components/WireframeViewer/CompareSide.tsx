import { useMemo, type RefObject } from 'react';
import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { useFrameStage } from '../../useFrameStage';
import { screenPagePath } from '../../wireframePagePath';
import type { WireframeDiffMarks } from '../../wireframePages/renderWireframeNode';
import { wireframeStageFiles } from '../../wireframeStageFiles';
import { WireframeStage } from './WireframeStage';

type Props = {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly marks: ReadonlyMap<string, WireframeDiffMarks>;
  readonly screenId: string;
  readonly side: 'A' | 'B';
  readonly revision: number;
};

export const CompareSide = ({
  frameRef,
  artifact,
  document,
  marks,
  screenId,
  side,
  revision,
}: Props) => {
  const files = useMemo(
    () => wireframeStageFiles({ artifact, document, marks }),
    [artifact, document, marks],
  );
  const stage = useFrameStage({ files });
  const screen = document.screens.find((entry) => entry.id === screenId) ?? null;
  const path = screenPagePath({ screenId, state: null });
  return (
    <section
      aria-label={`${side} · v${revision}`}
      data-testid={`wireframe-compare-${side.toLowerCase()}`}
      className="flex min-w-0 flex-col gap-2"
    >
      <span className="font-mono text-secondary text-muted-foreground">
        {side} · v{revision} · {screen === null ? 'not in this version' : path}
      </span>
      {screen === null || stage.status !== 'ready' ? (
        <div className="min-h-40 rounded-md bg-subtle" />
      ) : (
        <WireframeStage
          frameRef={frameRef}
          stageId={stage.stageId}
          path={path}
          loadKey={0}
          viewport={screen.viewport}
          zoom="fit"
          contentHeight={0}
          title={`${screen.title} in v${revision}`}
        />
      )}
    </section>
  );
};
