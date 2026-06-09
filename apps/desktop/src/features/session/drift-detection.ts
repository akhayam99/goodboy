import type { AgentKind } from './agent-kind';

type DriftSignal =
  | 'plan-marker-from-non-planner'
  | 'file-edit-from-readonly-kind'
  | 'impl-output-from-readonly-kind';

export type DriftViolation = {
  readonly kind: AgentKind;
  readonly signal: DriftSignal;
  readonly detail: string;
};

export type DriftDetectionInput = {
  readonly agentKind: AgentKind;
  readonly assistantText: string;
  readonly filesEdited: ReadonlyArray<string>;
};

const PLAN_MARKER_RE = /<<plan>>/;

const IMPL_DIFF_RE =
  /(?:^|\n)[+-]\s*(?:function|class|const|let|import|export|return|if|for|while)\s/;

const PLAN_MARKER_EXEMPT: ReadonlySet<AgentKind> = new Set(['planner', 'generic']);

const FILE_EDIT_EXEMPT: ReadonlySet<AgentKind> = new Set([
  'implementer',
  'debugger',
  'tester',
  'generic',
]);

const IMPL_OUTPUT_EXEMPT: ReadonlySet<AgentKind> = new Set([
  'implementer',
  'debugger',
  'tester',
  'generic',
]);

const DOC_EXTENSIONS = /\.(?:md|mdx|txt|rst)$/;

export function detectDrift(input: DriftDetectionInput): ReadonlyArray<DriftViolation> {
  const { agentKind, assistantText, filesEdited } = input;
  const violations: DriftViolation[] = [];

  if (!PLAN_MARKER_EXEMPT.has(agentKind) && PLAN_MARKER_RE.test(assistantText)) {
    violations.push({
      kind: agentKind,
      signal: 'plan-marker-from-non-planner',
      detail: `${agentKind} agent emitted a <<plan>> marker. only planner agents should produce plans.`,
    });
  }

  if (filesEdited.length > 0 && !FILE_EDIT_EXEMPT.has(agentKind)) {
    const isDocsAgent = agentKind === 'docs';
    const nonDocFiles = isDocsAgent
      ? filesEdited.filter((f) => !DOC_EXTENSIONS.test(f))
      : filesEdited;

    if (nonDocFiles.length > 0) {
      violations.push({
        kind: agentKind,
        signal: 'file-edit-from-readonly-kind',
        detail: `${agentKind} agent edited ${nonDocFiles.length} file(s). this role should not modify files.`,
      });
    }
  }

  if (!IMPL_OUTPUT_EXEMPT.has(agentKind) && IMPL_DIFF_RE.test(assistantText)) {
    violations.push({
      kind: agentKind,
      signal: 'impl-output-from-readonly-kind',
      detail: `${agentKind} agent produced implementation-like diff output. consider spawning an implementer.`,
    });
  }

  return violations;
}
