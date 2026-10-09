import { useEffect, useState } from 'react';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { ShellFrame, seedShellChrome } from '../shellChrome';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

export const ArtifactsRowsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: null, withStates: true });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens: 'plans',
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ArtifactStudio sessionId={SESSION_ID} />} />;
};
