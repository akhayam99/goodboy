import { useEffect, useState } from 'react';
import { PageTrailContext } from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { ArtifactStudio } from '../../../../../../features/artifacts/components/ArtifactStudio';
import { SessionBackRow } from '../../../../../../features/session/components/SessionWorkspace/SessionBackRow';
import { sceneClock } from '../../../sceneClock';
import { REPORT_ARTIFACT_ID, SESSION, SESSION_ID, seedArtifactScene } from '../../artifactSeed';
import { ShellFrame, seedShellChrome } from '../../shellChrome';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
};

const SCROLL_PX = 400;

const SETTLE_MS = 600;

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

const scrollReport = (): void => {
  const viewport = document
    .querySelector('[data-testid="artifact-shell"]')
    ?.closest<HTMLElement>('[data-page-scroller]');
  if (viewport === null || viewport === undefined) {
    return;
  }
  viewport.scrollTop = SCROLL_PX;
};

export const ArtifactReportScrolledScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);

  useEffect(() => {
    seedArtifactScene({ focusedArtifactId: REPORT_ARTIFACT_ID, withStates: true });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens: 'plans',
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(scrollReport, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={
        <PageTrailContext.Provider value={<SessionBackRow sessionId={SESSION_ID} />}>
          <ArtifactStudio sessionId={SESSION_ID} />
        </PageTrailContext.Provider>
      }
    />
  );
};
