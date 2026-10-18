import type { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

type Concept = keyof typeof CONCEPT_ICONS;

export type ActivityRowKind =
  | 'workflow-run'
  | 'orchestrated-run'
  | 'fix-run'
  | 'agent'
  | 'question'
  | 'question-answered'
  | 'rebase'
  | 'plan'
  | 'report'
  | 'wireframe'
  | 'learning'
  | 'branch';

type Params = {
  readonly kind: ActivityRowKind;
};

export const activityRowConcept = ({ kind }: Params): Concept => {
  switch (kind) {
    case 'workflow-run':
      return 'workflows';
    case 'orchestrated-run':
      return 'orchestrator';
    case 'fix-run':
      return 'resolve';
    case 'agent':
      return 'agents';
    case 'question':
      return 'questions';
    case 'question-answered':
      return 'questionAnswered';
    case 'rebase':
      return 'history';
    case 'plan':
      return 'plans';
    case 'report':
      return 'report';
    case 'wireframe':
      return 'wireframe';
    case 'learning':
      return 'learning';
    case 'branch':
      return 'branch';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
