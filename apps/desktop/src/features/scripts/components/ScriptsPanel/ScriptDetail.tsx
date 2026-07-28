import { Button, Divider, ScrollFade } from '@goodboy/ui';
import { Pencil } from 'lucide-react';
import type { WorkspaceScript } from '@goodboy/types';
import type { ScriptRunRecord } from '../../scripts';
import { ScriptRunOutput } from './ScriptRunOutput';

type Props = {
  readonly script: WorkspaceScript;
  readonly run: ScriptRunRecord | null;
  readonly completedAt: number | undefined;
  readonly onEdit: () => void;
};

export const ScriptDetail = ({ script, run, completedAt, onEdit }: Props) => (
  <ScrollFade className="min-h-0 flex-1" viewportClassName="p-3">
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil size={13} aria-hidden />
          Edit
        </Button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle/40 p-3 font-mono text-xs leading-relaxed text-foreground/80">
        {script.body}
      </pre>
      {run !== null ? (
        <>
          <Divider />
          <ScriptRunOutput run={run} completedAt={completedAt} />
        </>
      ) : null}
    </div>
  </ScrollFade>
);
