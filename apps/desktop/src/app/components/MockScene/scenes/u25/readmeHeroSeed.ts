import { useAppStore } from '../../../../../store';
import { SESSION_ID } from '../activityRunSeed';
import { seedBrandLimits } from '../brand/limitsSeed';
import { seedR4Rail } from './r4RailSeed';
import { seedHeroAgents } from './seedHeroAgents';

const HERO_GOAL =
  'Key every credit on the processor event id so a retried webhook never posts twice, and show support a stuck delivery in notify-relay.';

const seedHeroGoal = (): void => {
  useAppStore.setState((state) => ({
    sessionSlots: {
      ...state.sessionSlots,
      [SESSION_ID]: (state.sessionSlots[SESSION_ID] ?? []).map((slot) =>
        slot.key === 'goal' ? { ...slot, value: HERO_GOAL } : slot,
      ),
    },
  }));
};

export const seedReadmeHero = (): void => {
  const items = useAppStore.getState().sessionResolveQueueItems[SESSION_ID];
  seedR4Rail({ isCardFolded: false });
  if (items !== undefined) {
    useAppStore.setState((state) => ({
      sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION_ID]: items },
    }));
  }
  seedBrandLimits();
  seedHeroAgents();
  seedHeroGoal();
  useAppStore.setState((state) => ({
    activeLens: { ...state.activeLens, [SESSION_ID]: 'context' },
  }));
};
