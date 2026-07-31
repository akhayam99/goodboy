import { ArrowRight, FolderGit2, LayoutDashboard, Lightbulb, Sparkles, Wrench } from 'lucide-react';
import { Block } from './Block';
import { Callout } from './Callout';
import { DefinitionList } from './DefinitionList';
import { SectionHeader } from './SectionHeader';

type Props = Record<never, never>;

export const StageBoardSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<LayoutDashboard size={14} aria-hidden className="text-primary" />}
      title="Stage board"
      description="The home screen. One glance at every session in the workspace, grouped by what it needs from you right now."
      tone="primary"
    />

    <Block title="How sessions are grouped">
      <DefinitionList
        rows={[
          {
            term: 'attention',
            desc: 'An agent replied or hit a question and is waiting on you. Clear these first.',
            icon: <Sparkles size={11} aria-hidden />,
            tone: 'warning',
          },
          {
            term: 'running',
            desc: 'A turn is active. The agent is working; nothing to do but watch or queue a follow-up.',
            icon: <ArrowRight size={11} aria-hidden />,
            tone: 'info',
          },
          {
            term: 'review',
            desc: 'Work landed and is ready to read: a diff to check, a PR to look at.',
            icon: <Wrench size={11} aria-hidden />,
            tone: 'success',
          },
          {
            term: 'building / done',
            desc: 'In-progress or finished work that does not need you yet. Kept out of the way.',
            icon: <FolderGit2 size={11} aria-hidden />,
            tone: 'neutral',
          },
        ]}
      />
    </Block>

    <Block title="Opening a session">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Click any card to enter that session. You land in chat by default; from there the lens
        switcher takes you to the diff, terminal, IDE, or a studio. The board stays one keystroke
        away, so you can fan out across several sessions and come back to triage.
      </p>
    </Block>

    <Callout tone="info" icon={<Lightbulb size={13} />}>
      The board is per workspace. Spend for the whole workspace stays glanceable in the top bar, so
      you never have to open a session to see what it is costing you.
    </Callout>
  </div>
);
