import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { PlanDrawerRunStub } from './PlanDrawerRunStub';
import { seedPlanDrawerScene, type PlanDrawerVariant } from './planDrawerSeed';
import { usePlanDrawerAutoplay, type AutoplayStep } from './usePlanDrawerAutoplay';

const EDIT_BUTTON = '[data-testid="plan-drawer-edit"]';

const EDITED_SOURCE =
  '# Reconcile the settlement export\n\n## Goal\nEvery batch matches its invoice, to the cent.';

const AUTOPLAY: Readonly<Record<PlanDrawerVariant, ReadonlyArray<AutoplayStep>>> = {
  waiting: [],
  drafts: [],
  revising: [],
  unchanged: [{ selector: '[data-testid="plan-bar-send"]' }],
  question: [],
  editing: [{ selector: EDIT_BUTTON }],
  conflict: [
    { selector: EDIT_BUTTON },
    { selector: '[data-testid="plan-editor"] textarea', text: EDITED_SOURCE },
    { selector: '[data-testid="artifact-save"]' },
  ],
  split: [],
  follow: [],
};

type Props = {
  readonly variant: PlanDrawerVariant;
};

const PlanDrawerScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((state) => state.drawer !== null);

  useEffect(() => {
    seedPlanDrawerScene({ variant });
    setIsReady(true);
  }, [variant]);

  usePlanDrawerAutoplay({ isReady, steps: AUTOPLAY[variant] });

  if (!isReady) {
    return null;
  }

  return (
    <main
      data-testid="plan-drawer-scene"
      data-variant={variant}
      className="flex h-screen bg-background text-foreground"
    >
      <DrawerColumn
        main={<PlanDrawerRunStub />}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
    </main>
  );
};

export const U21_PLAN_DRAWER_SCENES = {
  'plan-drawer-waiting': () => <PlanDrawerScene variant="waiting" />,
  'plan-drawer-drafts': () => <PlanDrawerScene variant="drafts" />,
  'plan-drawer-revising': () => <PlanDrawerScene variant="revising" />,
  'plan-drawer-unchanged': () => <PlanDrawerScene variant="unchanged" />,
  'plan-drawer-question': () => <PlanDrawerScene variant="question" />,
  'plan-drawer-editing': () => <PlanDrawerScene variant="editing" />,
  'plan-drawer-conflict': () => <PlanDrawerScene variant="conflict" />,
  'plan-drawer-split': () => <PlanDrawerScene variant="split" />,
  'plan-drawer-follow': () => <PlanDrawerScene variant="follow" />,
};
