import { WorkNode, cn, type Tone, type WorkNodeMark, type WorkNodeState } from '@goodboy/ui';

export type StateNodeSpec = {
  readonly kind: string;
  readonly state: WorkNodeState;
  readonly mark: WorkNodeMark;
  readonly tone: Tone;
  readonly label: string;
  readonly isSpinning: boolean;
  readonly hasUnread: boolean;
};

type Props = {
  readonly node: StateNodeSpec;
  readonly className?: string;
  readonly isOnSelectedRow?: boolean;
  readonly isNamed?: boolean;
  readonly isCheckboxSlot?: boolean;
};

const YIELDS_TO_CHECKBOX =
  'group-focus-within/select-row:invisible group-hover/select-row:invisible group-data-[selecting=true]/select-list:invisible';

export const StateNode = ({
  node,
  className,
  isOnSelectedRow = false,
  isNamed = false,
  isCheckboxSlot = false,
}: Props) => (
  <span
    aria-hidden={isNamed ? undefined : true}
    className={cn('inline-flex shrink-0', isCheckboxSlot && YIELDS_TO_CHECKBOX, className)}
    data-node-kind={node.kind}
    data-node-tone={node.tone}
  >
    <WorkNode
      state={node.state}
      mark={node.mark}
      tone={node.tone}
      label={node.label}
      isSpinning={node.isSpinning}
      hasUnread={node.hasUnread}
      isTransparent={isOnSelectedRow}
      size="sm"
    />
  </span>
);
