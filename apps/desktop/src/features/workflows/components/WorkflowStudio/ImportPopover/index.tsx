import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { AnchoredPopover, Button, Input, PopoverFooter, useDropdown } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useWorkflowImport } from '../../WorkflowsPanel/useWorkflowImport';
import { ImportGroupSection } from './ImportGroupSection';
import { catalogCount, importedToast, selectionSummary } from './importCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly takenNames: ReadonlySet<string>;
};

const PANEL_WIDTH = 640;

export const ImportPopover = ({ workspaceId, takenNames }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 420,
    expectedWidth: PANEL_WIDTH,
    width: 'w-[40rem] max-w-[calc(100vw-2rem)]',
  });
  const importer = useWorkflowImport({ workspaceId });
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const visible = importer.groups
    .map((group) => ({
      group,
      workflows: group.workflows.filter(
        (workflow) => needle === '' || workflow.name.toLowerCase().includes(needle),
      ),
    }))
    .filter(({ group, workflows }) => group.status !== 'ready' || workflows.length > 0);
  const readyWithWorkflows = importer.groups.filter(
    (group) => group.status === 'ready' && group.workflows.length > 0,
  );
  const total = readyWithWorkflows.reduce((sum, group) => sum + group.workflows.length, 0);
  const isSettled = importer.groups.every((group) => group.status !== 'loading');
  const count = importer.picks.length;

  const onToggleOpen = () => {
    if (!dropdown.open) {
      setQuery('');
      importer.load();
    }
    dropdown.toggle();
  };

  const onImport = async () => {
    const imported = await importer.importSelected();
    if (imported === null) {
      return;
    }
    dropdown.close();
    showToast({ kind: 'success', message: importedToast({ picks: imported }) });
  };

  const emptyText =
    importer.groups.length === 0
      ? 'No other workspaces yet'
      : isSettled && visible.length === 0
        ? needle === ''
          ? 'No workflows to import'
          : 'No workflows match that search'
        : null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Import workflows"
      className="flex max-h-[min(32rem,70vh)] flex-col bg-elevated"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={onToggleOpen}
        >
          <Download size={ICON_SIZE.row} aria-hidden />
          Import
        </Button>
      }
    >
      <div className="flex shrink-0 items-center gap-3 p-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search workflows</span>
          <Search
            size={ICON_SIZE.row}
            aria-hidden
            className="pointer-events-none absolute left-2 text-faint-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workflows"
            className="h-7 pl-7 text-xs"
          />
        </label>
        {total > 0 ? (
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            {catalogCount({ workflows: total, workspaces: readyWithWorkflows.length })}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {emptyText === null ? (
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
            {visible.map(({ group, workflows }) => (
              <ImportGroupSection
                key={group.workspaceId}
                group={group}
                workflows={workflows}
                selected={importer.selected}
                takenNames={takenNames}
                disabled={importer.isImporting}
                onToggle={importer.toggle}
              />
            ))}
          </div>
        ) : (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
      <PopoverFooter className="flex min-h-10 shrink-0 items-center gap-2 px-3 py-1.5">
        <span
          role={importer.importError === null ? undefined : 'alert'}
          className={
            importer.importError === null
              ? 'min-w-0 flex-1 truncate text-2xs text-muted-foreground'
              : 'min-w-0 flex-1 truncate text-2xs text-danger'
          }
        >
          {importer.importError === null
            ? selectionSummary({ picks: importer.picks })
            : `Couldn't import. ${importer.importError}`}
        </span>
        {count > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={importer.clear}
            disabled={importer.isImporting}
          >
            Clear
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={count === 0}
          isBusy={importer.isImporting}
          onClick={() => void onImport()}
        >
          {count > 0 ? `Import ${count}` : 'Import'}
        </Button>
      </PopoverFooter>
    </AnchoredPopover>
  );
};
