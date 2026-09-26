import { useState } from 'react';
import { FileWarning } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'artifact_capture_failed' }>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
};

export const REPAIR_PROMPT =
  'your last artifact block could not be captured. re-emit it once, alone, with nothing else in the turn: an opening `<<artifact v=1 kind=...>>` line, one JSON object on the lines below it with title, format, content and metadata, and a closing `<</artifact>>` line. keep the content identical to what you already wrote, do not restate it in prose, and do not wrap the block in a code fence.';

export const ArtifactCaptureNoticeCard = ({ item, sessionId = null, agentId = null }: Props) => {
  const [open, setOpen] = useState(false);
  const [repaired, setRepaired] = useState(false);
  const sendTurn = useAppStore((s) => s.sendTurn);
  const canRepair = sessionId !== null && agentId !== null && !repaired;

  const handleRepair = () => {
    if (!canRepair) {
      return;
    }
    setRepaired(true);
    void sendTurn({ sessionId, agentId, content: REPAIR_PROMPT });
  };

  return (
    <TranscriptDisclosure
      tone="warning"
      open={open}
      bodyClassName="gap-2 text-label text-foreground"
      header={
        <TranscriptRowHeader
          tone="warning"
          icon={<FileWarning size={ICON_SIZE.row} aria-hidden />}
          eyebrow="artifact"
          preview="artifact block could not be captured"
          data-testid="artifact-capture-notice"
          open={open}
          onToggle={() => setOpen((value) => !value)}
        />
      }
    >
      <p className="min-w-0">{item.message}</p>
      <p className="min-w-0 text-muted-foreground">
        the turn is intact and the last captured artifact is unchanged.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="warning"
          emphasis="outline"
          size="sm"
          onClick={handleRepair}
          disabled={!canRepair}
          title={repaired ? 'repair already requested once' : 'ask the agent to re-emit the block'}
        >
          Retry capture
        </Button>
        {repaired ? (
          <span className="text-secondary text-muted-foreground">repair requested</span>
        ) : null}
      </div>
    </TranscriptDisclosure>
  );
};
