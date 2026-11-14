import { X } from 'lucide-react';
import { Button, IconButton, useEscapeLayer } from '@goodboy/ui';
import {
  SPAWN_RECORD_NOT_RECORDED,
  SPAWN_RECORD_STILL_WORKING,
  type SpawnRecordModel,
} from '../spawnRecordOf';
import { SpawnRecordField } from './SpawnRecordField';
import { SpawnRecordWentIn } from './SpawnRecordWentIn';

type OpenTranscriptParams = {
  readonly agentId: string;
};

type Props = {
  readonly record: SpawnRecordModel;
  readonly onClose: () => void;
  readonly onOpenTranscript: (params: OpenTranscriptParams) => void;
};

type MutedParams = {
  readonly text: string | null;
};

const muted = ({ text }: MutedParams) => (
  <span className="text-muted-foreground">{text ?? SPAWN_RECORD_NOT_RECORDED}</span>
);

export const SpawnRecord = ({ record, onClose, onOpenTranscript }: Props) => {
  useEscapeLayer(onClose, true);
  const roleNote =
    record.role.reason === null
      ? null
      : record.role.whyNot === null
        ? record.role.reason
        : `Why not ${record.role.whyNot}: ${record.role.reason}`;
  return (
    <aside
      aria-label={`Record of ${record.title}`}
      data-spawn-record={record.agentId}
      className="flex min-w-0 flex-col gap-4 p-4"
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-title text-foreground">{record.title}</h2>
        <IconButton icon={X} size="xs" variant="ghost" label="Close the record" onClick={onClose} />
      </header>
      <dl className="flex min-w-0 flex-col gap-3">
        <SpawnRecordField name="Why">{record.why ?? muted({ text: null })}</SpawnRecordField>
        <SpawnRecordField name="Brief">{record.brief ?? muted({ text: null })}</SpawnRecordField>
        <SpawnRecordField name="Role">
          <span>
            {record.role.label}
            {roleNote === null ? null : (
              <span className="text-muted-foreground">{` · ${roleNote}`}</span>
            )}
          </span>
        </SpawnRecordField>
        <SpawnRecordField name="Model">
          {record.model === null ? (
            muted({ text: null })
          ) : (
            <span>
              {record.model}
              {record.modelReason === null ? null : (
                <span className="text-muted-foreground">{` · ${record.modelReason}`}</span>
              )}
            </span>
          )}
        </SpawnRecordField>
        <SpawnRecordField name="Went in">
          <SpawnRecordWentIn items={record.wentIn} />
        </SpawnRecordField>
        <SpawnRecordField name="Done when">
          {record.doneWhen ?? muted({ text: null })}
        </SpawnRecordField>
        <SpawnRecordField name="Result">
          {record.isLive
            ? SPAWN_RECORD_STILL_WORKING
            : (record.result ?? muted({ text: 'No result' }))}
        </SpawnRecordField>
        <SpawnRecordField name="Attempts">
          <span>
            {record.attempts}
            {record.attemptsNote === null ? null : (
              <span className="text-muted-foreground">{` · ${record.attemptsNote}`}</span>
            )}
          </span>
        </SpawnRecordField>
      </dl>
      <div className="flex min-w-0 items-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOpenTranscript({ agentId: record.agentId })}
        >
          Open transcript
        </Button>
      </div>
    </aside>
  );
};
