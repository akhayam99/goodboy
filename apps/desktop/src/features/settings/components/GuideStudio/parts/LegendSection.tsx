import type { SessionStage } from '@goodboy/types';
import { tintClasses } from '@goodboy/ui';
import { MODE_COPY, PICKER_MODES } from '../../../../permissions/modeCopy';
import { contextUsageTone } from '../../../../session/contextUsageTone';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../session/session-stage';
import { LegendaGrid } from './LegendaGrid';
import { LegendBlock } from './LegendBlock';

const STAGES: ReadonlyArray<SessionStage> = ['attention', 'running', 'review', 'building', 'done'];

type Props = Record<never, never>;

export const LegendSection = ({}: Props) => (
  <div className="grid grid-cols-2 gap-3">
    <LegendBlock title="Board columns">
      <LegendaGrid
        rows={STAGES.map((stage) => ({
          dot: tintClasses(STAGE_TONE[stage]).dot,
          label: SESSION_STAGE_META[stage].label,
          desc: SESSION_STAGE_META[stage].reason,
        }))}
      />
    </LegendBlock>

    <LegendBlock title="Steps and agents">
      <LegendaGrid
        rows={[
          {
            dot: tintClasses('warning').dot,
            label: 'waiting',
            desc: 'needs your answer or approval',
          },
          { dot: tintClasses('danger').dot, label: 'failed', desc: 'ended with an error' },
          {
            dot: tintClasses('neutral').dot,
            label: 'the rest',
            desc: 'running, done or skipped, no color',
          },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Permission modes">
      <LegendaGrid
        rows={[...PICKER_MODES].reverse().map((mode) => ({
          dot: tintClasses(MODE_COPY[mode].tone).dot,
          label: MODE_COPY[mode].label,
          desc: MODE_COPY[mode].short.replace(/\.$/, '').toLowerCase(),
        }))}
      />
    </LegendBlock>

    <LegendBlock title="Context meter">
      <LegendaGrid
        rows={[
          {
            dot: contextUsageTone({ pct: 0, prefix: 'bg' }),
            label: 'under 50%',
            desc: 'plenty of room',
          },
          {
            dot: contextUsageTone({ pct: 0.5, prefix: 'bg' }),
            label: '50 to 75%',
            desc: 'keep an eye on it',
          },
          {
            dot: contextUsageTone({ pct: 0.75, prefix: 'bg' }),
            label: '75 to 90%',
            desc: 'wrap up or summarize soon',
          },
          {
            dot: contextUsageTone({ pct: 0.9, prefix: 'bg' }),
            label: '90% or more',
            desc: 'start a new session',
          },
        ]}
      />
    </LegendBlock>
  </div>
);
