import type { IconGlyph } from '@goodboy/ui/icons';
import { WORK_NODE_GLYPH_SIZE, WorkNode, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { OpenQuestion } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { ARTIFACT_KIND_MARKER_LABEL } from '../../../../../artifacts/artifactPresentation';
import { IntegrationGlyph } from '../../../../../../shared/components/IntegrationGlyph';
import { rowStateNode, rowStateTone } from '../../../../../workTreeModel/rowStateCopy';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { sessionEventGlyph } from '../../../../timeline/sessionEventPresentation';
import { workEventGlyph } from '../../../../timeline/workEventGlyph';
import { activityRowConcept, type ActivityRowKind } from '../../../../timeline/activityRowConcept';

type Props = {
  readonly item: TimelineRowItem;
  readonly progress?: number | null;
};

type KindParams = {
  readonly kind: ActivityRowKind;
};

const iconOf = ({ kind }: KindParams): IconGlyph => CONCEPT_ICONS[activityRowConcept({ kind })];

const toneOf = ({ kind }: KindParams): Tone => CONCEPT_TONE[activityRowConcept({ kind })];

type ConceptParams = {
  readonly icon: IconGlyph;
  readonly tone: Tone;
  readonly label: string;
  readonly isEmphasized: boolean;
};

const conceptNode = ({ icon: Icon, tone, label, isEmphasized }: ConceptParams) => (
  <WorkNode
    look="quiet"
    state="marker"
    tone={tone}
    label={label}
    mark={{
      kind: 'glyph',
      glyph: (
        <Icon
          size={WORK_NODE_GLYPH_SIZE}
          weight={isEmphasized ? 'bold' : 'regular'}
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
        look="quiet"
        state={node.state}
        label={node.label}
        mark={{ kind: 'dot' }}
        size={item.grade === 'entry' ? 'md' : 'sm'}
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
        look="quiet"
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
  if (entry.kind === 'work') {
    return conceptNode({ ...workEventGlyph({ work: entry.work }), isEmphasized: false });
  }
  if (entry.kind === 'learning') {
    return conceptNode({
      icon: iconOf({ kind: 'learning' }),
      tone: toneOf({ kind: 'learning' }),
      label: 'Explained',
      isEmphasized: false,
    });
  }
  if (entry.kind === 'plan') {
    return conceptNode({
      icon: iconOf({ kind: 'plan' }),
      tone: toneOf({ kind: 'plan' }),
      label: 'Plan',
      isEmphasized: true,
    });
  }
  if (entry.kind === 'artifact') {
    return conceptNode({
      icon: iconOf({ kind: entry.artifact.kind }),
      tone: toneOf({ kind: entry.artifact.kind }),
      label: ARTIFACT_KIND_MARKER_LABEL[entry.artifact.kind],
      isEmphasized: true,
    });
  }
  if (entry.kind === 'question') {
    const isOpen = entry.questions.every((question) => question.status === 'open');
    if (isOpen) {
      return conceptNode({
        icon: iconOf({ kind: 'question' }),
        tone: rowStateTone({ state: item.rowState }),
        label: 'Question',
        isEmphasized: false,
      });
    }
    return conceptNode({
      icon: iconOf({ kind: 'question-answered' }),
      tone: toneOf({ kind: 'question-answered' }),
      label: questionResolvedLabel({ questions: entry.questions }),
      isEmphasized: false,
    });
  }
  return conceptNode({
    icon: iconOf({ kind: 'branch' }),
    tone: 'neutral',
    label: 'Branch',
    isEmphasized: false,
  });
};
