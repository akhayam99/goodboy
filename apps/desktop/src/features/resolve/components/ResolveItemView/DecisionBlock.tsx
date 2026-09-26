import type { ReactNode } from 'react';
import { Button, Markdown, SectionHeader, Textarea } from '@goodboy/ui';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
import type { ResolveProposalKind } from '../../../../store/slices/resolve/resolveProposalKind';
import type { ResolveDecisionMode } from '../../resolveItemDraft';

const INSTRUCTION_LABEL = 'Instructions for agent';

type Props = {
  readonly fieldId: string;
  readonly reply: string;
  readonly instruction: string;
  readonly mode: ResolveDecisionMode;
  readonly proposalKind: ResolveProposalKind;
  readonly isAnswering: boolean;
  readonly isDelivered: boolean;
  readonly deliveredReply: string | null;
  readonly deliverySupport: string | null;
  readonly isBusy: boolean;
  readonly onChangeReply: (value: string) => void;
  readonly onChangeInstruction: (value: string) => void;
  readonly onEditReply: () => void;
  readonly settingsLine?: ReactNode;
};

const sectionLabel = ({
  mode,
  isDelivered,
  isAnswering,
}: {
  readonly mode: ResolveDecisionMode;
  readonly isDelivered: boolean;
  readonly isAnswering: boolean;
}): string => {
  if (isDelivered) {
    return RESOLVE_ITEM_LABEL.replyPosted;
  }
  if (mode === 'fix') {
    return isAnswering ? RESOLVE_ITEM_LABEL.agentAnswer : INSTRUCTION_LABEL;
  }
  if (mode === 'close') {
    return RESOLVE_ITEM_LABEL.refusalReply;
  }
  return mode === 'discuss' ? RESOLVE_ITEM_LABEL.discussionReply : RESOLVE_ITEM_LABEL.reply;
};

const proposalHint = ({
  proposalKind,
}: {
  readonly proposalKind: ResolveProposalKind;
}): string | undefined => {
  if (proposalKind === 'none') {
    return RESOLVE_ITEM_LABEL.noProposal;
  }
  if (proposalKind === 'reply_only') {
    return RESOLVE_ITEM_LABEL.replyOnlyProposal;
  }
  return undefined;
};

const sectionHint = ({
  mode,
  isDelivered,
  proposalKind,
}: {
  readonly mode: ResolveDecisionMode;
  readonly isDelivered: boolean;
  readonly proposalKind: ResolveProposalKind;
}): string | undefined => {
  if (mode === 'close') {
    return RESOLVE_ITEM_LABEL.refusalNote;
  }
  if (mode === 'discuss') {
    return RESOLVE_ITEM_LABEL.discussionNote;
  }
  if (isDelivered) {
    return undefined;
  }
  return proposalHint({ proposalKind });
};

export const DecisionBlock = ({
  fieldId,
  reply,
  instruction,
  mode,
  proposalKind,
  isAnswering,
  isDelivered,
  deliveredReply,
  deliverySupport,
  isBusy,
  onChangeReply,
  onChangeInstruction,
  onEditReply,
  settingsLine,
}: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <SectionHeader
      label={sectionLabel({ mode, isDelivered, isAnswering })}
      hint={sectionHint({ mode, isDelivered, proposalKind })}
      headingLevel={3}
    />
    {mode === 'fix' ? (
      <Textarea
        id={`${fieldId}-instruction`}
        aria-label={isAnswering ? RESOLVE_ITEM_LABEL.agentAnswer : INSTRUCTION_LABEL}
        value={instruction}
        rows={3}
        disabled={isBusy}
        className="max-h-48 text-sm"
        onChange={(event) => onChangeInstruction(event.target.value)}
      />
    ) : isDelivered ? (
      <>
        <Markdown
          text={deliveredReply ?? reply}
          variant="preview"
          className="max-w-[65ch] text-sm text-foreground"
        />
        {deliverySupport !== null && (
          <p className="text-2xs text-muted-foreground">{deliverySupport}</p>
        )}
      </>
    ) : mode === 'edit_reply' || mode === 'close' || mode === 'discuss' ? (
      <Textarea
        id={`${fieldId}-reply`}
        aria-label={RESOLVE_ITEM_LABEL.replyPreview}
        value={reply}
        rows={3}
        disabled={isBusy}
        className="max-h-48 text-sm"
        onChange={(event) => onChangeReply(event.target.value)}
      />
    ) : (
      <div className="flex min-w-0 flex-col items-start gap-2">
        <Markdown text={reply} variant="preview" className="max-w-[65ch] text-sm text-foreground" />
        <Button size="sm" variant="ghost" onClick={onEditReply}>
          {RESOLVE_ITEM_LABEL.editReply}
        </Button>
      </div>
    )}
    {!isDelivered && mode !== 'fix' && settingsLine}
  </div>
);
