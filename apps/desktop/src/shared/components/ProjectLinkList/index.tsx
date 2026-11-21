import { useState, type ReactNode } from 'react';
import { Plus } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, SearchField } from '@goodboy/ui';
import type { Project, WorkspaceId } from '@goodboy/types';
import { useProjectLinking } from '../../hooks/useProjectLinking';
import { NAMES } from '../../utils/names';

import { LazyNewWorkspaceForm } from '../NewWorkspaceForm/LazyNewWorkspaceForm';
import { ProjectGroups } from './ProjectGroups';

const FILTER_VISIBLE_FROM = 10;

type ProjectParams = {
  readonly project: Project;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly emptyHint?: string;
  readonly editorExtra?: (params: { readonly project: Project }) => ReactNode;
  readonly rowBadge?: (params: { readonly project: Project }) => ReactNode;
  readonly editorScripts?: (params: { readonly project: Project }) => ReactNode;
  readonly isRowInitiallyOpen?: (params: ProjectParams) => boolean;
  readonly heading?: (params: { readonly count: number }) => ReactNode;
  readonly hint?: string;
};

export const ProjectLinkList = ({
  workspaceId,
  emptyHint,
  editorExtra,
  rowBadge,
  editorScripts,
  isRowInitiallyOpen,
  heading,
  hint,
}: Props) => {
  const linking = useProjectLinking({ workspaceId });
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const trimmedQuery = query.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {heading?.({ count: linking.linked.length })}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isAdding}
          disabled={isAdding || linking.busy}
          onClick={() => setIsAdding(true)}
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          {NAMES.addProject}
        </Button>
      </div>
      {linking.linked.length >= FILTER_VISIBLE_FROM ? (
        <SearchField
          value={query}
          onChange={setQuery}
          ariaLabel={NAMES.searchProjects}
          placeholder={NAMES.searchProjects}
          className="w-64 max-w-full"
        />
      ) : null}
      {hint !== undefined && <p className="text-meta text-faint-foreground">{hint}</p>}
      {isAdding ? (
        <div className="rounded-lg p-4 ring-1 ring-inset ring-border-soft">
          <LazyNewWorkspaceForm
            mode="add"
            workspaceId={workspaceId}
            titleRole="heading"
            onCreated={() => setIsAdding(false)}
            onCancel={() => setIsAdding(false)}
            backLabel="Cancel"
          />
        </div>
      ) : null}
      {linking.linked.length === 0 && emptyHint !== undefined && (
        <p className="text-body text-muted-foreground">{emptyHint}</p>
      )}
      {linking.linked.length > 0 ? (
        <ProjectGroups
          workspaceId={workspaceId}
          projects={
            trimmedQuery === ''
              ? linking.linked
              : linking.linked.filter((project) =>
                  project.name.toLowerCase().includes(trimmedQuery),
                )
          }
          busy={linking.busy}
          query={query}
          onUnlink={linking.unlink}
          editorExtra={editorExtra}
          rowBadge={rowBadge}
          editorScripts={editorScripts}
          isRowInitiallyOpen={isRowInitiallyOpen}
        />
      ) : null}
      {linking.error !== null && (
        <p role="alert" className="text-meta text-danger">
          {linking.error}
        </p>
      )}
    </div>
  );
};
