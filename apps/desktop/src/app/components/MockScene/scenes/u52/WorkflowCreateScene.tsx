import { useEffect, useRef, useState } from 'react';
import type { WorkflowDraft } from '../../../../../features/workflows/engine';
import { blankWorkflowDraft } from '../../../../../features/workflows/engine/blankWorkflowDraft';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import {
  OVERRIDES,
  PRESETS,
  PROVIDERS,
  WORKSPACE,
  WORKSPACE_ID,
  noop,
} from '../flow-audit/fixtures';

export type WorkflowCreateState = 'empty' | 'filled' | 'drafting' | 'create-failed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly state: WorkflowCreateState;
};

const FILLED: WorkflowDraft = {
  ...blankWorkflowDraft(),
  name: 'Fix a flaky test',
  description: 'The task names a test that fails some of the time',
  entryCheck: 'Run the test ten times and confirm it fails at least once',
  stopRule: 'It never fails, or it fails every time',
  steps: [
    {
      key: 'mock-create-step-reproduce',
      sourceStepId: null,
      libraryStepId: null,
      role: 'scout',
      name: 'Reproduce the failure',
      prompt: 'Run the ledger-core suite until the test fails and keep the log.',
      expectedOutput: 'The log of one failing run',
      provider: '',
      model: '',
      effort: 'medium',
      verbosity: 'normal',
      size: null,
    },
    {
      key: 'mock-create-step-fix',
      sourceStepId: null,
      libraryStepId: null,
      role: 'implementer',
      name: 'Fix the cause',
      prompt: 'Remove the shared state the test depends on.',
      expectedOutput: 'A passing run, ten times in a row',
      provider: '',
      model: '',
      effort: 'medium',
      verbosity: 'normal',
      size: null,
    },
  ],
};

export const WorkflowCreateScene = ({ theme, state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyDocumentTheme({ theme });
    const form = state === 'empty' ? blankWorkflowDraft() : FILLED;
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      providers: PROVIDERS,
      workspaceOverrides: { [WORKSPACE_ID]: OVERRIDES },
      sessions: [],
      phaseTemplates: { [WORKSPACE_ID]: PRESETS },
      stepLibrary: { [WORKSPACE_ID]: [] },
      workflowStudioView: 'workflows',
      workflowStudioDrafts: { [WORKSPACE_ID]: { workflowId: null, form } },
      workflowGenerations:
        state === 'drafting'
          ? { [WORKSPACE_ID]: { status: 'running', description: form.description } }
          : {},
      loadPhaseTemplates: async () => undefined,
      loadStepLibrary: async () => undefined,
      setWorkflowStudioVisible: noop,
      savePhaseTemplate: async () => {
        throw new Error('The database is locked. Try again in a moment.');
      },
    });
    setIsReady(true);
  }, [theme, state]);

  useEffect(() => {
    if (!isReady || state !== 'create-failed') {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const create = Array.from(rootRef.current?.querySelectorAll('button') ?? []).find(
        (button) => button.textContent?.trim() === 'Create workflow',
      );
      create?.click();
    });
    return () => cancelAnimationFrame(frame);
  }, [isReady, state]);

  if (!isReady) {
    return null;
  }

  return (
    <div ref={rootRef} className="contents">
      <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} />
    </div>
  );
};
