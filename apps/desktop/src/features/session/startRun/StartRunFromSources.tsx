import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { StartRun } from '../components/StartRun/StartRun';
import type { StartRunSources } from './startRunSources';

type StartRunProps = ComponentProps<typeof StartRun>;

type TextParams = {
  readonly text: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly label: string;
  readonly fieldLabel: string;
  readonly seedText: string;
  readonly seedBranch: string | null;
  readonly sources: StartRunSources;
  readonly header: ReactNode;
  readonly note: string;
  readonly blockedReason: string | null;
  readonly cancelLabel: string;
  readonly between: NonNullable<StartRunProps['between']>;
  readonly onCancel: (params: TextParams) => void;
  readonly onLeave: (params: TextParams) => void;
  readonly onLaunched: () => void;
};

const SOURCE_ROWS = 3;

export const StartRunFromSources = ({
  workspaceId,
  sessionId,
  label,
  fieldLabel,
  seedText,
  seedBranch,
  sources,
  header,
  note,
  blockedReason,
  cancelLabel,
  between,
  onCancel,
  onLeave,
  onLaunched,
}: Props) => (
  <StartRun
    workspaceId={workspaceId}
    sessionId={sessionId}
    label={label}
    fieldLabel={fieldLabel}
    hint={null}
    seedText={seedText}
    seedBranch={seedBranch}
    sources={sources}
    header={header}
    note={note}
    blockedReason={blockedReason}
    minRows={SOURCE_ROWS}
    isFromSources
    between={between}
    actions={({ isStarting, text }) => (
      <Button variant="ghost" size="sm" disabled={isStarting} onClick={() => onCancel({ text })}>
        {cancelLabel}
      </Button>
    )}
    onLaunched={onLaunched}
    onLeave={onLeave}
  />
);
