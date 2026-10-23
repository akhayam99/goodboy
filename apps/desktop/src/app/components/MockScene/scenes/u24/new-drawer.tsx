import { useEffect, useState } from 'react';
import { DrawerColumn, ScrollFade } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { WritePanel } from '../../../../../features/artifacts/components/WritePanel';
import { NewDrawerBody } from '../../../../../features/session/components/NewDrawer/NewDrawerBody';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import type { NewDrawerForm } from '../../../../../store/slices/drawer/state';
import { RULES_PROVIDERS } from '../audit/workflowRulesSeed';
import { SESSION, seedActivityRunScene } from '../activityRunSeed';

type SceneState = {
  readonly form: NewDrawerForm;
  readonly width: number;
};

type Props = {
  readonly state: SceneState;
};

const NewDrawerScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState({
      providers: RULES_PROVIDERS,
      refreshProviders: async () => undefined,
    });
    setIsReady(true);
  }, [state]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen bg-background text-foreground" style={{ width: state.width }}>
      <DrawerColumn
        main={
          <ScrollFade className="min-h-0 flex-1">
            <div className="px-6 py-4">
              <SessionOverviewPane session={SESSION} />
            </div>
          </ScrollFade>
        }
        drawer={
          <NewDrawerBody
            session={SESSION}
            payload={{ form: state.form }}
            writePanel={WritePanel}
            onClose={() => undefined}
          />
        }
        sizing="reader"
        placement="overlay"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const U24_NEW_DRAWER_SCENES = {
  'new-drawer-write': () => <NewDrawerScene state={{ form: 'report', width: 1440 }} />,
  'new-drawer-write-wireframe': () => <NewDrawerScene state={{ form: 'wireframe', width: 1440 }} />,
  'new-drawer-narrow': () => <NewDrawerScene state={{ form: 'report', width: 1100 }} />,
};
