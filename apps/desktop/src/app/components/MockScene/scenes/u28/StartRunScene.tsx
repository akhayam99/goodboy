import { useEffect, useState } from 'react';
import { PageColumn } from '@goodboy/ui';
import { brandId, type IsoDateTime, type Workflow, type WorkflowId } from '@goodboy/types';
import { StartRun } from '../../../../../features/session/components/StartRun/StartRun';
import { startRunEventName } from '../../../../../features/session/startRun/startRunEventName';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { useSceneClicks } from '../audit/useSceneClicks';
import { SESSION, SESSION_ID, WORKSPACE_ID, seedResolveScene } from '../resolveSeed';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SCENE_PROVIDERS } from './sceneProviders';

const clock = sceneClock({ anchor: '2026-10-28T10:00:00.000Z' });
const NOW = clock.iso({ at: '2026-10-28T10:00:00.000Z' });

const PRESET_ID = brandId<WorkflowId>({ value: 'mock-start-run-preset-layout' });

const PRESET: Workflow = {
  id: PRESET_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Fix a layout',
  description: 'Find the layout bug, fix it, check the page.',
  steps: [],
  isPreset: true,
  origin: 'custom',
  createdAt: brandId<IsoDateTime>({ value: NOW }),
  updatedAt: brandId<IsoDateTime>({ value: NOW }),
};

type Props = {
  readonly text: string;
  readonly openLabels: ReadonlyArray<string>;
};

export const StartRunScene = ({ text, openLabels }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'hl/fix-duplicate-credit' },
      telemetryAt: NOW,
      lens: null,
    });
    useAppStore.setState({
      phaseTemplates: { [WORKSPACE_ID]: [PRESET] },
      providers: SCENE_PROVIDERS,
      workspaceValues: {},
      loadWorkspaceValue: async () => null,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || text === '') {
      return;
    }
    window.dispatchEvent(
      new CustomEvent(startRunEventName({ sessionId: SESSION_ID }), { detail: { text } }),
    );
  }, [isReady, text]);

  useSceneClicks({
    isReady,
    labels: openLabels,
    selector: 'button',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={
        <PageColumn className="flex flex-col gap-6 py-8">
          <div className="flex justify-center">
            <StartRun workspaceId={WORKSPACE_ID} sessionId={SESSION_ID} />
          </div>
        </PageColumn>
      }
    />
  );
};
