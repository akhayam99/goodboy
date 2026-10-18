import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { Project, WorkspaceId } from '@goodboy/types';
import { useProjectLinking } from '../../hooks/useProjectLinking';
import { ICON_SIZE } from '../conceptIcons';
import { NewWorkspaceForm } from '../NewWorkspaceForm';
import { ProjectGroups } from './ProjectGroups';

const FILTER_VISIBLE_FROM = 10;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly emptyHint?: string;
  readonly editorExtra?: (params: { readonly project: Project }) => ReactNode;
  readonly rowBadge?: (params: { readonly project: Project }) => ReactNode;
  readonly editorScripts?: (params: { readonly project: Project }) => ReactNode;
  readonly heading?: (params: { readonly count: number }) => ReactNode;
  readonly hint?: string;
};

export const ProjectLinkList = ({
  workspaceId,
  emptyHint,
  editorExtra,
  rowBadge,
  editorScripts,
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
        {linking.linked.length >= FILTER_VISIBLE_FROM ? (
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter folders"
            aria-label="Filter folders"
            className="h-8 w-48 rounded-md border border-border-soft bg-background px-2 text-label text-foreground outline-none placeholder:text-faint-foreground focus:border-border"
          />
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isAdding}
          disabled={isAdding || linking.busy}
          onClick={() => setIsAdding(true)}
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          Add folder
        </Button>
      </div>
      {hint !== undefined && <p className="text-meta text-faint-foreground">{hint}</p>}
      {isAdding ? (
        <div className="rounded-lg p-4 ring-1 ring-inset ring-border-soft">
          <NewWorkspaceForm
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
        />
      ) : null}
      {linking.error !== null && (
        <p role="alert" className="text-label text-danger">
          {linking.error}
        </p>
      )}
    </div>
  );
};
