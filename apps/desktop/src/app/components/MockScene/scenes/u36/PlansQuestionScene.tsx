import { useEffect, useState } from 'react';
import { brandId, type AgentId, type IsoDateTime, type OpenQuestionId } from '@goodboy/types';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';

const NOW = brandId<IsoDateTime>({ value: '2026-09-14T16:40:00.000Z' });

type Props = {
  readonly theme: 'dark' | 'light';
};

export const PlansQuestionScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedArtifactScene({ focusedArtifactId: null, withStates: true });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens: 'plans',
    });
    useAppStore.setState({
      sessionOpenQuestions: {
        [SESSION_ID]: [
          {
            id: brandId<OpenQuestionId>({ value: 'mock-question-tester-fixture' }),
            sessionId: SESSION_ID,
            createdByAgentId: brandId<AgentId>({ value: 'mock-artifact-agent-tester' }),
            text: 'Should the notify-relay fixture keep the 409 retry case?',
            suggestedAnswers: ['Keep it', 'Drop it'],
            isBlocking: false,
            userAnswer: null,
            status: 'open',
            createdAt: NOW,
          },
        ],
      },
    });
    setIsReady(true);
  }, [theme]);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ArtifactStudio sessionId={SESSION_ID} />} />;
};
