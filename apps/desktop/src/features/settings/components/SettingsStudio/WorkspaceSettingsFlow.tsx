import { useEffect, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, formatError, IconButton } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import {
  applyWorkspaceSettings,
  restorePlan,
  type PagePlan,
  type PlanScope,
} from '../../workspaceSettings/plan';
import { workspaceSettingsSnapshot } from '../../workspaceSettings/snapshot';
import type { WorkspaceSettingsWrite } from '../../workspaceSettings/snapshot';
import { loadFlowSources, type FlowSource } from '../../workspaceSettings/sources';
import { FlowPlanPreview } from './FlowPlanPreview';
import { FlowSourcePicker } from './FlowSourcePicker';
import { workspacePageEntry } from './workspacePages';

export type FlowMode = 'copy' | 'restore';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly scope: PlanScope;
  readonly mode: FlowMode;
  readonly onClose: () => void;
};

type Done = {
  readonly message: string;
  readonly undo: ReadonlyArray<Partial<WorkspaceSettingsWrite>>;
};

const scopeLabel = ({ scope }: { readonly scope: PlanScope }): string =>
  scope === 'all' ? 'All workspace pages' : workspacePageEntry({ page: scope }).label;

const toggled = ({
  set,
  key,
}: {
  readonly set: ReadonlySet<string>;
  readonly key: string;
}): ReadonlySet<string> =>
  set.has(key) ? new Set([...set].filter((entry) => entry !== key)) : new Set([...set, key]);

export const WorkspaceSettingsFlow = ({ workspaceId, scope, mode, onClose }: Props) => {
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'this workspace',
  );
  const [sources, setSources] = useState<ReadonlyArray<FlowSource> | null>(null);
  const [sourceId, setSourceId] = useState<WorkspaceId | null>(null);
  const [step, setStep] = useState<'pick' | 'preview'>(mode === 'copy' ? 'pick' : 'preview');
  const [restore] = useState<ReadonlyArray<PagePlan>>(() =>
    mode === 'restore'
      ? restorePlan({
          scope,
          current: workspaceSettingsSnapshot({ state: useAppStore.getState(), workspaceId }),
        })
      : [],
  );
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(restore.slice(0, 1).map((page) => page.page)),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (mode !== 'copy') {
      return;
    }
    let isCancelled = false;
    loadFlowSources({ workspaceId, scope })
      .then((loaded) => {
        if (!isCancelled) {
          setSources(loaded);
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setSources([]);
          setError(formatError(err));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [mode, scope, workspaceId]);

  const source = sources?.find((candidate) => candidate.id === sourceId) ?? null;
  const plan = mode === 'copy' ? (source?.plan ?? []) : restore;
  const included = plan.filter((page) => !skipped.has(page.page));
  const items = included.flatMap((page) => page.items);
  const count = items.length;
  const title =
    mode === 'copy'
      ? step === 'pick' || source === null
        ? 'Copy settings from…'
        : `Copy from ${source.name} to ${workspaceName}`
      : 'Restore defaults';

  const showPreview = () => {
    setExpanded(new Set(plan.length === 0 ? [] : [plan[0]!.page]));
    setStep('preview');
  };

  const apply = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await applyWorkspaceSettings({
        state: useAppStore.getState(),
        workspaceId,
        writes: items.map((item) => item.write),
      });
      setDone({
        message:
          mode === 'copy'
            ? `Copied ${pluralize(count, 'setting')} from ${source?.name ?? 'the other workspace'}.`
            : `Restored ${pluralize(count, 'setting')} to the default.`,
        undo: items.map((item) => item.undo),
      });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const undo = async () => {
    if (done === null) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await applyWorkspaceSettings({
        state: useAppStore.getState(),
        workspaceId,
        writes: done.undo,
      });
      onClose();
    } catch (err) {
      setError(formatError(err));
      setIsBusy(false);
    }
  };

  if (done !== null) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-lg bg-fill px-3 py-2 text-label text-foreground"
      >
        <Check size={ICON_SIZE.row} aria-hidden className="text-success" />
        <span className="min-w-0 flex-1">{done.message}</span>
        {error === null ? null : <span className="text-label text-danger">{error}</span>}
        <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => void undo()}>
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          Undo
        </Button>
        <IconButton icon={X} label="Dismiss" variant="ghost" onClick={onClose} />
      </div>
    );
  }

  return (
    <section
      aria-label={mode === 'copy' ? 'Copy settings from another workspace' : 'Restore defaults'}
      className="flex flex-col gap-3 rounded-lg border border-border-soft bg-fill p-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="min-w-0 truncate text-row text-foreground">{title}</h2>
        <span className="truncate text-meta text-faint-foreground">
          {step === 'pick' ? `${scopeLabel({ scope })} · values only` : scopeLabel({ scope })}
        </span>
        <span className="flex-1" />
        <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
      </div>

      {step === 'pick' ? (
        <FlowSourcePicker sources={sources} sourceId={sourceId} onPick={setSourceId} />
      ) : (
        <FlowPlanPreview
          mode={mode}
          plan={plan}
          sourceName={source?.name ?? null}
          count={count}
          pageCount={included.length}
          skipped={skipped}
          expanded={expanded}
          onToggleSkip={(page) => setSkipped((current) => toggled({ set: current, key: page }))}
          onToggleOpen={(page) => setExpanded((current) => toggled({ set: current, key: page }))}
        />
      )}

      {error === null ? null : (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {step === 'pick' ? (
          <>
            <Button size="sm" disabled={source === null} onClick={showPreview}>
              Preview changes
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <span className="text-meta text-faint-foreground">
              Nothing changes until you confirm.
            </span>
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={count === 0 || isBusy}
              aria-busy={isBusy}
              onClick={() => void apply()}
            >
              {mode === 'copy' ? 'Copy' : 'Restore'} {pluralize(count, 'setting')}
            </Button>
            {mode === 'copy' ? (
              <Button variant="ghost" size="sm" onClick={() => setStep('pick')}>
                Back
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <span className="text-meta text-faint-foreground">
              One change, and you can undo it.
            </span>
          </>
        )}
      </div>
    </section>
  );
};
