import { useState } from 'react';
import type { WireframeArtifact } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { WireframeCompare } from '../../../../../features/wireframes/components/WireframeViewer/WireframeCompare';
import type { WireframeVersion } from '../../../../../features/wireframes/wireframeVersion';
import { useCompareFrames } from './compareFrames';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly versions: ReadonlyArray<WireframeVersion>;
};

export const CompareStage = ({ artifact, versions }: Props) => {
  const [pair, setPair] = useState({ before: 2, after: 3 });
  useCompareFrames();
  return (
    <ScrollFade className="h-full" viewportClassName="px-6 py-5">
      <WireframeCompare
        artifact={artifact}
        versions={versions}
        beforeRevision={pair.before}
        afterRevision={pair.after}
        onChange={setPair}
        onExit={() => undefined}
      />
    </ScrollFade>
  );
};
