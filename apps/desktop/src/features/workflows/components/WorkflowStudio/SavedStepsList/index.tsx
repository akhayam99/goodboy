import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE, recommendedModelForRole } from '@goodboy/core';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';
import type { StepDraft } from '../../../engine';
import { useSavedSteps } from '../../../hooks/useSavedSteps';
import {
  savedStepGroups,
  savedStepNote,
  stepDefArgsFromDraft,
  type SavedStep,
} from '../../../savedSteps';
import { SavedStepEditor } from './SavedStepEditor';
import { SavedStepRow } from './SavedStepRow';
import { SavedStepSection } from './SavedStepSection';
import {
  isSavedStepDirty,
  openSavedStep,
  type ExpandedSavedStep,
  type SavedStepTarget,
} from './savedStepDraft';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly tabs: ReactNode;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const SavedStepsList = ({ workspaceId, connectedProviders, tabs }: Props) => {
  const groups = useSavedSteps({ workspaceId });
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const saveStepDef = useAppStore((state) => state.saveStepDef);
  const deleteStepDef = useAppStore((state) => state.deleteStepDef);
  const [expanded, setExpanded] = useState<ExpandedSavedStep | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleModels = overrides?.roleModels ?? null;
  const defaultProvider: ProviderId =
    overrides?.defaultProviderId ??
    connectedProviders[0] ??
    DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;

  const recommendedModel = (draft: StepDraft): string =>
    recommendedModelForRole({
      role: draft.role,
      provider: draft.provider !== '' ? draft.provider : defaultProvider,
      prefs: roleModels,
    });

  const open = (target: SavedStepTarget | null) => {
    setError(null);
    setExpanded(target === null ? null : openSavedStep({ target }));
  };

  type RunParams = {
    readonly failure: string;
    readonly work: () => Promise<void>;
  };

  const run = async ({ failure, work }: RunParams): Promise<boolean> => {
    setIsBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (caught) {
      setError(`${failure} ${errorText(caught)}`);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const needsSave = (current: ExpandedSavedStep): boolean =>
    current.target.kind === 'new' ||
    (!current.target.step.isBuiltin && isSavedStepDirty({ expanded: current }));

  const commitThen = (next: SavedStepTarget | null) => {
    if (expanded === null || !needsSave(expanded)) {
      open(next);
      return;
    }
    const { target, draft } = expanded;
    if (draft.name.trim() === '') {
      setError('Name the step first.');
      return;
    }
    void run({
      failure: "Couldn't save the step.",
      work: async () => {
        await saveStepDef(
          stepDefArgsFromDraft({
            draft,
            workspaceId,
            ...(target.kind === 'saved' && { id: target.step.id }),
            baseStepId: target.kind === 'saved' ? target.step.baseStepId : null,
          }),
          workspaceId,
        );
      },
    }).then((isSaved) => {
      if (isSaved) {
        open(next);
      }
    });
  };

  const isTarget = (target: SavedStepTarget): boolean =>
    expanded !== null &&
    expanded.target.kind === target.kind &&
    (target.kind === 'new' ||
      (expanded.target.kind === 'saved' && expanded.target.step.id === target.step.id));

  const toggle = (target: SavedStepTarget) => commitThen(isTarget(target) ? null : target);

  const saveCopy = async (step: SavedStep) => {
    if (expanded === null) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const saved = await saveStepDef(
        {
          ...stepDefArgsFromDraft({ draft: expanded.draft, workspaceId, baseStepId: step.id }),
          name: `${step.name} copy`,
        },
        workspaceId,
      );
      const copy = savedStepGroups({ defs: [saved] }).workspace[0];
      if (copy !== undefined) {
        open({ kind: 'saved', step: copy });
      }
    } catch (caught) {
      setError(`Couldn't save the step. ${errorText(caught)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (expanded === null) {
      return;
    }
    const { target } = expanded;
    if (target.kind === 'new') {
      open(null);
      return;
    }
    const isRemoved = await run({
      failure: "Couldn't remove the step.",
      work: () => deleteStepDef(target.step.id, workspaceId),
    });
    if (isRemoved) {
      open(null);
    }
  };

  const patch = (next: Partial<StepDraft>) =>
    setExpanded((current) =>
      current === null ? null : { ...current, draft: { ...current.draft, ...next } },
    );

  const editorFor = (mode: 'builtin' | 'saved' | 'new', step: SavedStep | null) =>
    expanded === null ? null : (
      <SavedStepEditor
        mode={mode}
        draft={expanded.draft}
        recommendedProvider={defaultProvider}
        recommendedModel={recommendedModel(expanded.draft)}
        connectedProviders={connectedProviders}
        isBusy={isBusy}
        error={error}
        onChange={patch}
        onSaveCopy={() => {
          if (step !== null) {
            void saveCopy(step);
          }
        }}
        onRemove={() => void remove()}
        onDone={() => commitThen(null)}
      />
    );

  const isOpen = (step: SavedStep): boolean =>
    expanded !== null && expanded.target.kind === 'saved' && expanded.target.step.id === step.id;
  const isCreating = expanded !== null && expanded.target.kind === 'new';

  const renderRow = (step: SavedStep) => (
    <SavedStepRow
      key={step.id}
      step={step}
      note={savedStepNote({ step, groups })}
      isExpanded={isOpen(step)}
      editor={isOpen(step) ? editorFor(step.isBuiltin ? 'builtin' : 'saved', step) : null}
      onToggle={() => toggle({ kind: 'saved', step })}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center">{tabs}</div>
        <Button size="sm" onClick={() => toggle({ kind: 'new' })} disabled={isCreating}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          New step
        </Button>
      </div>
      <SavedStepSection label="Built in">{groups.builtin.map(renderRow)}</SavedStepSection>
      <SavedStepSection label="This workspace">
        {isCreating ? (
          <li
            aria-label="New step"
            className="flex min-w-0 flex-col rounded-lg border border-border-soft bg-subtle pt-2"
          >
            {editorFor('new', null)}
          </li>
        ) : null}
        {groups.workspace.map(renderRow)}
        {groups.workspace.length === 0 && !isCreating ? (
          <li>
            <EmptyState
              icon={CONCEPT_ICONS.workflows}
              tone={CONCEPT_TONE.workflows}
              title="No saved steps yet"
              description="Save a step from any workflow, or copy a built-in step to change it."
              size="inline"
              bordered
            />
          </li>
        ) : null}
      </SavedStepSection>
    </div>
  );
};
