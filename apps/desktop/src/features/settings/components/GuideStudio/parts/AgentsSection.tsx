import { ArrowRight, Network } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { DogMascot } from '../../../../../shared/components/DogMascot';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { Block } from './Block';
import { Chip } from './Chip';
import { DefinitionList } from './DefinitionList';

type Props = Record<never, never>;

export const AgentsSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<DogMascot size={ICON_SIZE.control} className="text-warning" />}
      label="Agents"
      hint="One provider invocation inside a session. A session can host multiple agents, same provider or different ones, and they nest as a tree."
    />

    <Block title="Why multiple agents per session">
      <DefinitionList
        rows={[
          {
            term: 'Role separation',
            desc: 'Spawn a planning agent on one model, then a coding agent on another. Each keeps its own transcript.',
            icon: <CONCEPT_ICONS.workflows size={11} aria-hidden />,
            tone: 'primary',
          },
          {
            term: 'Workflow steps',
            desc: 'A workflow defines ordered steps (plan, implement, done). Each step spawns an agent with its own model and system prompt.',
            icon: <ArrowRight size={11} aria-hidden />,
            tone: 'success',
          },
          {
            term: 'Subagent trees',
            desc: 'An agent can fan out into subagents for sweeps or parallel exploration. They render as a tree under their parent, so you can follow who spawned whom.',
            icon: <Network size={11} aria-hidden />,
            tone: 'info',
          },
        ]}
      />
    </Block>

    <Block title="Reading the agent row">
      <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-subtle/50 p-4 text-xs">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Second line of each agent
        </span>
        <div className="flex flex-wrap items-center gap-2 font-mono text-foreground">
          <Chip tone="primary">model</Chip>
          <span className="text-muted-foreground/40">·</span>
          <Chip tone="info">↓ input</Chip>
          <span className="text-muted-foreground/40">·</span>
          <Chip tone="warning">↑ output</Chip>
          <span className="text-muted-foreground/40">·</span>
          <Chip tone="success">cost</Chip>
          <span className="text-muted-foreground/40">·</span>
          <Chip tone="neutral">⏱ age</Chip>
        </div>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Below that line, a thin bar shows context window utilization. Hover for exact numbers.
        </p>
      </div>
    </Block>
  </div>
);
