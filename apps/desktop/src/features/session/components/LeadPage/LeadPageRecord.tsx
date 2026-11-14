import { ArrowLeft } from 'lucide-react';
import { Button, ScrollFade } from '@goodboy/ui';
import { SpawnRecord } from '../../../auto/tree/SpawnRecord';
import type { SpawnRecordModel } from '../../../auto/tree/spawnRecordOf';

type OpenTranscriptParams = {
  readonly agentId: string;
};

type Props = {
  readonly record: SpawnRecordModel;
  readonly hasBackArrow: boolean;
  readonly onClose: () => void;
  readonly onOpenTranscript: (params: OpenTranscriptParams) => void;
};

export const LeadPageRecord = ({ record, hasBackArrow, onClose, onOpenTranscript }: Props) => (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    {hasBackArrow ? (
      <div className="flex shrink-0 items-center px-3 pt-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft aria-hidden className="size-4" />
          Agents
        </Button>
      </div>
    ) : null}
    <ScrollFade className="min-h-0 flex-1" viewportClassName="flex flex-col">
      <SpawnRecord record={record} onClose={onClose} onOpenTranscript={onOpenTranscript} />
    </ScrollFade>
  </div>
);
