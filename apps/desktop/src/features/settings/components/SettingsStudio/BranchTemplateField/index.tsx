import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  BRANCH_PLACEHOLDERS,
  branchTemplateProblem,
  DEFAULT_BRANCH_TEMPLATE,
  NO_TASK_BRANCH_TEMPLATE,
} from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { Chip, Input } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../../store/slices/overrides/selectResolvedSettings';
import { BranchTemplateOption } from './BranchTemplateOption';
import { BranchTemplatePreview } from './BranchTemplatePreview';
import { branchPreview } from './branchPreview';
import {
  lastSessionGoal,
  lastSessionTaskId,
  SAMPLE_GOAL,
  SAMPLE_TASK_ID,
} from './branchPreviewSource';
import { branchTemplateProblemCopy } from './branchTemplateProblemCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type Choice = 'plain' | 'task' | 'custom';

const CHOICES: ReadonlyArray<Choice> = ['plain', 'task', 'custom'];

const choiceOf = (template: string): Choice => {
  if (template === NO_TASK_BRANCH_TEMPLATE) {
    return 'plain';
  }
  if (template === DEFAULT_BRANCH_TEMPLATE) {
    return 'task';
  }
  return 'custom';
};

const PRESET: Readonly<Record<Exclude<Choice, 'custom'>, string>> = {
  plain: NO_TASK_BRANCH_TEMPLATE,
  task: DEFAULT_BRANCH_TEMPLATE,
};

const previewNote = ({
  goal,
  taskId,
}: {
  readonly goal: string | null;
  readonly taskId: string | null;
}): string => {
  const source =
    goal === null
      ? `Preview from a sample session, “${SAMPLE_GOAL}”, and task ${SAMPLE_TASK_ID}.`
      : `Preview from your last session, “${goal}”, and task ${taskId ?? SAMPLE_TASK_ID}.`;
  return `${source} A number is added only when the name is already taken. The task id is added when the session starts from a task.`;
};

export const BranchTemplateField = ({ workspaceId }: Props) => {
  const stored = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.defaultBranchTemplate ?? null,
  );
  const prefix = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultBranchPrefix,
  );
  const user = useAppStore(
    (state) => state.githubWorkspaceStatus[workspaceId]?.user ?? state.githubStatus?.user ?? null,
  );
  const goal = useAppStore((state) => lastSessionGoal({ state, workspaceId }));
  const taskId = useAppStore((state) => lastSessionTaskId({ state, workspaceId }));
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const reportError = useAppStore((state) => state.reportError);
  const template = stored === null || stored.trim() === '' ? DEFAULT_BRANCH_TEMPLATE : stored;
  const [isCustomOpen, setIsCustomOpen] = useState(choiceOf(template) === 'custom');
  const [draft, setDraft] = useState(template);
  const [isBusy, setIsBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setDraft(template);
    if (choiceOf(template) === 'custom') {
      setIsCustomOpen(true);
    }
  }, [template]);

  const picked: Choice = isCustomOpen ? 'custom' : choiceOf(template);
  const shown = picked === 'custom' ? draft : template;
  const problem = branchTemplateProblem({ template: shown });
  const previewGoal = goal ?? SAMPLE_GOAL;
  const previewTask = taskId ?? SAMPLE_TASK_ID;
  const preview = (forTemplate: string, withTask: boolean) =>
    branchPreview({
      template: forTemplate,
      prefix,
      user,
      goal: previewGoal,
      taskId: withTask ? previewTask : null,
    });

  const save = async (next: string) => {
    if (next === template) {
      return;
    }
    setIsBusy(true);
    try {
      await patchWorkspaceOverrides({
        workspaceId,
        patch: { defaultBranchTemplate: next === DEFAULT_BRANCH_TEMPLATE ? null : next },
      });
    } catch (error) {
      void reportError({ title: "Couldn't save the branch name", error, workspaceId });
    } finally {
      setIsBusy(false);
    }
  };

  const pick = (choice: Choice) => {
    if (choice === 'custom') {
      setIsCustomOpen(true);
      setDraft(template);
      return;
    }
    setIsCustomOpen(false);
    void save(PRESET[choice]);
  };

  const commitDraft = () => {
    if (branchTemplateProblem({ template: draft }) !== null) {
      return;
    }
    void save(draft);
  };

  const insertPlaceholder = (placeholder: string) => {
    const token = `{${placeholder}}`;
    const input = inputRef.current;
    const at = input?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, at)}${token}${draft.slice(at)}`;
    setDraft(next);
    input?.focus();
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const nextIndex = (index + step + CHOICES.length) % CHOICES.length;
    const next = CHOICES[nextIndex];
    if (next === undefined) {
      return;
    }
    pick(next);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="radiogroup" aria-label="Branch name" className="flex flex-col gap-1">
        {CHOICES.map((choice, index) => (
          <BranchTemplateOption
            key={choice}
            buttonRef={(node) => {
              optionRefs.current[index] = node;
            }}
            label={choice === 'custom' ? 'Custom' : preview(PRESET[choice], choice === 'task')}
            isMono={choice !== 'custom'}
            hint={
              choice === 'plain'
                ? 'Without a task id'
                : choice === 'task'
                  ? 'Task id first, when the session starts from a task'
                  : 'Write your own with placeholders'
            }
            isChecked={picked === choice}
            isDisabled={isBusy}
            onPick={() => pick(choice)}
            onKeyDown={(event) => moveFocus(event, index)}
          />
        ))}
      </div>
      {picked === 'custom' ? (
        <div className="flex min-w-0 flex-col gap-2 pl-9">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraft();
              }
            }}
            disabled={isBusy}
            spellCheck={false}
            autoComplete="off"
            aria-label="Custom branch template"
            aria-invalid={problem !== null}
            className="font-mono text-code"
          />
          <div role="group" aria-label="Placeholders" className="flex flex-wrap items-center gap-2">
            <span className="text-meta text-muted-foreground">Add</span>
            {BRANCH_PLACEHOLDERS.map((placeholder) => (
              <Chip
                key={placeholder}
                as="button"
                tone="neutral"
                shape="badge"
                size="control"
                ariaLabel={`Add {${placeholder}}`}
                onClick={() => insertPlaceholder(placeholder)}
                label={<span className="font-mono">{`{${placeholder}}`}</span>}
              />
            ))}
          </div>
          {problem === null ? null : (
            <p role="alert" className="text-meta text-danger">
              {branchTemplateProblemCopy({ problem, template: shown })}
            </p>
          )}
        </div>
      ) : null}
      <BranchTemplatePreview
        fromTask={preview(shown, true)}
        withoutTask={preview(shown, false)}
        isValid={problem === null}
        note={previewNote({ goal, taskId })}
      />
    </div>
  );
};
