export type EvidenceSourceKind =
  | 'task'
  | 'acceptance'
  | 'parent-instructions'
  | 'context-slot'
  | 'artifact'
  | 'prior-output'
  | 'finding'
  | 'question'
  | 'obligation';

export const EVIDENCE_SOURCE_KINDS: ReadonlyArray<EvidenceSourceKind> = [
  'task',
  'acceptance',
  'parent-instructions',
  'context-slot',
  'artifact',
  'prior-output',
  'finding',
  'question',
  'obligation',
];

export type EvidenceAvailability = 'delivered' | 'retrievable' | 'truncated' | 'unavailable';

export type EvidenceEntry = Readonly<{
  sourceId: string;
  kind: EvidenceSourceKind;
  label: string;
  provenance: string;
  revision: string;
  availability: EvidenceAvailability;
  detail: string | null;
}>;

export type EvidenceInventory = Readonly<{
  agentId: string;
  revision: string;
  entries: ReadonlyArray<EvidenceEntry>;
  omittedCount: number;
}>;

export type ContextReadOutcome = 'delivered' | 'unknown-source' | 'unauthorized' | 'unavailable';

export type GenerationLimitName =
  | 'depth'
  | 'root-descendants'
  | 'run-descendants'
  | 'repair-attempts'
  | 'structural-replans'
  | 'lineage';

export type GenerationCreationPath =
  'cluster' | 'fan-out' | 'capability' | 'question-delegate' | 'workflow-step';

export const GENERATION_CREATION_PATHS: ReadonlyArray<GenerationCreationPath> = [
  'cluster',
  'fan-out',
  'capability',
  'question-delegate',
  'workflow-step',
];

export const GENERATION_DEPTH_CAP = 3;
export const GENERATION_ROOT_DESCENDANT_CAP = 20;
export const GENERATION_RUN_CAP = 32;
export const GENERATION_REPAIR_ATTEMPT_CAP = 2;
export const GENERATION_STRUCTURAL_REPLAN_CAP = 1;
