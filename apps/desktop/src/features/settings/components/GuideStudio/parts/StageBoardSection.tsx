import { LayoutDashboard } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { Block } from './Block';
import { Callout } from './Callout';
import { DefinitionList } from './DefinitionList';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { StageGlyph } from './StageGlyph';

type Props = Record<never, never>;

export const StageBoardSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<LayoutDashboard size={ICON_SIZE.control} aria-hidden className="text-primary" />}
      label="Stage board"
      hint="The home screen. One glance at every session in the workspace, grouped by what it needs from you right now."
    />

    <Block title="How sessions are grouped">
      <DefinitionList
        rows={[
          {
            term: 'attention',
            desc: 'An agent replied or hit a question and is waiting on you. Clear these first.',
            icon: <StageGlyph stage="attention" />,
            tone: 'warning',
          },
          {
            term: 'running',
            desc: 'A turn is active. The agent is working; nothing to do but watch or queue a follow-up.',
            icon: <StageGlyph stage="running" />,
            tone: 'info',
          },
          {
            term: 'review',
            desc: 'Work landed and is ready to read: a diff to check, a PR to look at.',
            icon: <StageGlyph stage="review" />,
            tone: 'success',
          },
          {
            term: 'building',
            desc: 'In-progress work that does not need you yet. Kept out of the way.',
            icon: <StageGlyph stage="building" />,
            tone: 'neutral',
          },
          {
            term: 'done',
            desc: 'Finished work, parked. Nothing left to read or answer.',
            icon: <StageGlyph stage="done" />,
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

    <Callout tone="info" icon={<CONCEPT_ICONS.suggestion size={ICON_SIZE.row} />}>
      The board is per workspace. Spend for the whole workspace stays glanceable in the top bar, so
      you never have to open a session to see what it is costing you.
    </Callout>
  </div>
);
