import { DrawerFrame } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { HeroAgentRow } from './HeroAgentRow';
import { HERO_AGENTS } from './heroSeed';

const noop = () => undefined;

export const HeroAgentsPane = () => (
  <DrawerFrame
    title="Agents"
    icon={CONCEPT_ICONS.agents}
    iconClassName="text-muted-foreground"
    count={HERO_AGENTS.length}
    meta="The Lead picked a model for each one"
    onClose={noop}
  >
    <ol aria-label="Agents in this run" className="flex min-w-0 flex-col gap-3">
      {HERO_AGENTS.map((spec) => (
        <HeroAgentRow key={spec.key} spec={spec} />
      ))}
    </ol>
  </DrawerFrame>
);
