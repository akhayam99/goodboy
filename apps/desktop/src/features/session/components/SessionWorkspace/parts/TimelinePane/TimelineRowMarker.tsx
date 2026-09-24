import { GitBranch, MessageSquareCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WORK_NODE_GLYPH_SIZE, WorkNode, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import {
  ARTIFACT_KIND_CONCEPT,
  ARTIFACT_KIND_MARKER_LABEL,
} from '../../../../../artifacts/artifactPresentation';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import { rowStateNode } from '../../../../../workTreeModel/rowStateCopy';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { sessionEventGlyph } from '../../../../timeline/sessionEventPresentation';

type Props = {
  readonly item: TimelineRowItem;
  readonly progress?: number | null;
};

type ConceptParams = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly isEmphasized: boolean;
};

const HALO_OPACITY = 0.18;

const conceptNode = ({ icon: Icon, tone, label, isEmphasized }: ConceptParams) => (
  <WorkNode
    state="marker"
    tone={tone}
    label={label}
    mark={{
      kind: 'glyph',
      glyph: (
        <Icon
          size={WORK_NODE_GLYPH_SIZE}
          strokeWidth={2}
          fill={isEmphasized ? 'currentColor' : 'none'}
          fillOpacity={isEmphasized ? HALO_OPACITY : undefined}
          className={tintClasses(tone).icon}
        />
      ),
    }}
  />
);

const questionResolvedLabel = ({
  questions,
}: {
  readonly questions: ReadonlyArray<OpenQuestion>;
}): string => {
  if (questions.every((question) => question.status === 'dismissed')) {
    return 'Dismissed';
  }
  if (questions.every((question) => question.status === 'answered')) {
    return 'Answered';
  }
  return 'Resolved';
};

export const TimelineRowMarker = ({ item, progress = null }: Props) => {
  const { entry } = item;

  if (entry.kind === 'run' || entry.kind === 'agent') {
    const node = rowStateNode({ state: item.rowState });
    return (
      <WorkNode
        state={node.state}
        label={node.label}
        mark={item.nodeIndex == null ? { kind: 'dot' } : { kind: 'index', value: item.nodeIndex }}
        spinClassName={
          item.rowState.reason?.kind === 'deciding' ? (item.identity?.spin ?? undefined) : undefined
        }
        hasUnread={item.hasUnread}
        progress={progress}
      />
    );
  }
  if (entry.kind === 'issue') {
    return (
      <WorkNode
        state="marker"
        label="Issue"
        mark={{
          kind: 'glyph',
          glyph: <IntegrationGlyph provider={entry.task.provider} size={WORK_NODE_GLYPH_SIZE} />,
        }}
      />
    );
  }
  if (entry.kind === 'event') {
    const eventGlyph = sessionEventGlyph({ kind: entry.event.kind });
    return conceptNode({ ...eventGlyph, isEmphasized: false });
  }
  if (entry.kind === 'plan') {
    return conceptNode({
      icon: CONCEPT_ICONS.plans,
      tone: CONCEPT_TONE.plans,
      label: 'Plan',
      isEmphasized: true,
    });
  }
  if (entry.kind === 'artifact') {
    const concept = ARTIFACT_KIND_CONCEPT[entry.artifact.kind];
    return conceptNode({
      icon: CONCEPT_ICONS[concept],
      tone: CONCEPT_TONE[concept],
      label: ARTIFACT_KIND_MARKER_LABEL[entry.artifact.kind],
      isEmphasized: true,
    });
  }
  if (entry.kind === 'question') {
    const isOpen = entry.questions.every((question) => question.status === 'open');
    if (isOpen) {
      return conceptNode({
        icon: CONCEPT_ICONS.questions,
        tone: CONCEPT_TONE.questions,
        label: 'Question',
        isEmphasized: true,
      });
    }
    return conceptNode({
      icon: MessageSquareCheck,
      tone: 'neutral',
      label: questionResolvedLabel({ questions: entry.questions }),
      isEmphasized: false,
    });
  }
  return conceptNode({ icon: GitBranch, tone: 'neutral', label: 'Branch', isEmphasized: false });
};
