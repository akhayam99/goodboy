import { useEffect, useRef, useState } from 'react';
import {
  AnchoredPopover,
  Button,
  Input,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  SelectableRow,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { NAMES } from '../../../shared/utils/names';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';
import type { LeadCandidate, LeadChoice } from './leadCandidatesOf';
import type { LeadSend } from './LeadSend';
import { SEND_TO_LEAD_COPY } from './sendToLeadCopy';
import { startNewLead } from './startNewLead';
import { useLeadChoice } from './hooks/useLeadChoice';

type Props = {
  readonly cardKey: string;
  readonly send: LeadSend;
  readonly variant: 'primary' | 'secondary';
  readonly editNote: string | null;
};

type SendParams = {
  readonly candidate: LeadCandidate;
};

type LabelParams = {
  readonly choice: LeadChoice;
};

const triggerLabelOf = ({ choice }: LabelParams): string => {
  switch (choice.kind) {
    case 'one':
      return NAMES.sendToLead;
    case 'pick':
      return NAMES.sendToLeadPick;
    case 'none':
      return NAMES.startNewLead;
    default: {
      const exhaustive: never = choice;
      return exhaustive;
    }
  }
};

export const SendToLeadButton = ({ cardKey, send, variant, editNote }: Props) => {
  const { choice, reload } = useLeadChoice({ sessionId: send.lead.sessionId, item: send.lead });
  const [note, setNote] = useState(editNote ?? '');
  const [picked, setPicked] = useState<ReadonlyArray<LeadCandidate>>([]);
  const [isReading, setIsReading] = useState(false);
  const dropdown = useDropdown({
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
  });
  const { open: isOpen, close } = dropdown;
  const openPicker = dropdown.toggle;

  const sendTo = ({ candidate }: SendParams) => {
    close();
    void useAppStore.getState().sendToLead({
      ...send.send,
      key: cardKey,
      note,
      text: send.textOf({ note }),
      candidate,
    });
  };

  const startNew = () => {
    close();
    void startNewLead({ item: { ...send.send, key: cardKey, note, text: send.textOf({ note }) } });
  };

  const hasOpenedForEdit = useRef(false);
  useEffect(() => {
    if (editNote === null || hasOpenedForEdit.current || choice.kind === 'none') {
      return;
    }
    hasOpenedForEdit.current = true;
    setPicked(choice.kind === 'pick' ? choice.candidates : [choice.candidate]);
    openPicker();
  }, [editNote, choice, openPicker]);

  const onClick = async () => {
    if (isOpen) {
      close();
      return;
    }
    setIsReading(true);
    const latest = await reload().finally(() => setIsReading(false));
    if (latest.kind === 'none') {
      startNew();
      return;
    }
    if (latest.kind === 'one') {
      sendTo({ candidate: latest.candidate });
      return;
    }
    setPicked(latest.candidates);
    openPicker();
  };

  const label = triggerLabelOf({ choice });
  const look = actionButtonLookOf({ verb: label, variant });
  const button = (
    <Button
      size="sm"
      variant={look.variant}
      intent={look.intent}
      isBusy={isReading}
      aria-expanded={choice.kind === 'pick' ? isOpen : undefined}
      className="pointer-events-auto shrink-0"
      onClick={() => void onClick()}
    >
      {label}
    </Button>
  );
  const trigger =
    choice.kind === 'one' ? (
      <Tooltip content={SEND_TO_LEAD_COPY.sendTo({ title: choice.candidate.title })}>
        {button}
      </Tooltip>
    ) : (
      button
    );
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={SEND_TO_LEAD_COPY.pickTitle}
      hasBackdrop
      trigger={trigger}
    >
      <div data-lead-picker="" className="flex flex-col gap-2 p-2">
        <Input
          value={note}
          aria-label={SEND_TO_LEAD_COPY.pickNote}
          placeholder={SEND_TO_LEAD_COPY.pickNote}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            const [first] = picked;
            if (event.key === 'Enter' && first !== undefined) {
              event.preventDefault();
              sendTo({ candidate: first });
            }
          }}
        />
        <ul aria-label={SEND_TO_LEAD_COPY.pickTitle} className="flex flex-col">
          {picked.map((candidate) => (
            <li key={candidate.treeId}>
              <SelectableRow
                selected={false}
                ariaLabel={SEND_TO_LEAD_COPY.sendTo({ title: candidate.title })}
                onClick={() => sendTo({ candidate })}
                className="min-h-8 flex-col items-start rounded-sm px-2"
              >
                <span className="min-w-0 truncate text-ui text-foreground">
                  {SEND_TO_LEAD_COPY.leadOf({ title: candidate.title })}
                </span>
                <span className="min-w-0 truncate text-meta text-muted-foreground">
                  {`${candidate.stateWord} · ${candidate.reason}`}
                </span>
              </SelectableRow>
            </li>
          ))}
          <li>
            <SelectableRow
              selected={false}
              onClick={startNew}
              className="min-h-8 items-center rounded-sm px-2 text-ui"
            >
              {NAMES.startNewLead}
            </SelectableRow>
          </li>
        </ul>
      </div>
    </AnchoredPopover>
  );
};
