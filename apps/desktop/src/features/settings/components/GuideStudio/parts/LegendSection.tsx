import { Palette } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { LegendaGrid } from './LegendaGrid';
import { LegendBlock } from './LegendBlock';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = Record<never, never>;

export const LegendSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<Palette size={ICON_SIZE.control} aria-hidden className="text-primary" />}
      label="Legend"
      hint="Color meanings used throughout the interface."
    />

    <LegendBlock title="Agent status, workflow steps">
      <LegendaGrid
        rows={[
          { dot: 'bg-muted-foreground/50', label: 'pending', desc: 'not yet started' },
          { dot: 'bg-info', label: 'running', desc: 'active turn in progress' },
          { dot: 'bg-success', label: 'completed', desc: 'ended successfully' },
          { dot: 'bg-danger', label: 'failed', desc: 'ended with error' },
          {
            dot: 'bg-muted-foreground/30',
            label: 'skipped',
            desc: 'bypassed by workflow logic',
          },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Stage board groups">
      <LegendaGrid
        rows={[
          {
            dot: 'bg-warning motion-safe:animate-soft-pulse',
            label: 'attention',
            desc: 'amber pulse, an agent replied or hit a question',
          },
          {
            dot: 'bg-info',
            label: 'running',
            desc: 'info accent, a turn is active in this session',
          },
          {
            dot: 'bg-success',
            label: 'review',
            desc: 'work landed and is ready to read or ship',
          },
          {
            dot: 'bg-transparent ring-1 ring-border-soft',
            label: 'building / done',
            desc: 'no accent, nothing needs you yet',
          },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Edit types, transcript">
      <LegendaGrid
        rows={[
          { dot: 'bg-primary', label: 'create', desc: 'new file or resource added' },
          { dot: 'bg-muted-foreground/60', label: 'modify', desc: 'existing file changed' },
          { dot: 'bg-danger', label: 'delete', desc: 'file or resource removed' },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Context window, CTX fill level">
      <LegendaGrid
        rows={[
          { dot: 'bg-success', label: '< 50%', desc: 'comfortable: plenty of context remaining' },
          { dot: 'bg-info', label: '50 to 75%', desc: 'moderate: monitor closely' },
          { dot: 'bg-warning', label: '75 to 90%', desc: 'high: consider summarizing soon' },
          { dot: 'bg-danger', label: '90% or more', desc: 'critical: start a new session' },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Verbosity, output density">
      <LegendaGrid
        rows={[
          { dot: 'bg-success', label: 'brief', desc: 'bare minimum: one-liners only' },
          { dot: 'bg-info', label: 'normal', desc: 'standard prose with rationale' },
          { dot: 'bg-danger', label: 'verbose', desc: 'full long-form with alternatives' },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Permission mode, tool access">
      <LegendaGrid
        rows={[
          { dot: 'bg-danger', label: 'bypass', desc: 'all tools used freely, no prompts' },
          { dot: 'bg-warning', label: 'edits', desc: 'file edits allowed; bash asks first' },
          { dot: 'bg-info', label: 'default', desc: 'writes and runs ask for approval' },
          {
            dot: 'bg-muted-foreground/40',
            label: 'plan',
            desc: 'no tool calls executed, read-only',
          },
        ]}
      />
    </LegendBlock>

    <LegendBlock title="Autorun badge">
      <LegendaGrid
        rows={[
          {
            dot: 'bg-primary',
            label: 'Autorun',
            desc: 'autorun mode: next action fires without user confirmation',
          },
        ]}
      />
    </LegendBlock>
  </div>
);
