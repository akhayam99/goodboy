import { useEffect, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button, ConfirmPopover, HeaderActions, ICON_SIZE } from '@goodboy/ui';
import { BAND_TONE } from '../../../suggestions/bandTone';
import { NextStepMenu } from '../../../suggestions/NextStepMenu';
import { NextStepRebasePicker } from '../../../suggestions/NextStepRebasePicker';
import { NextStepTile } from '../../../suggestions/NextStepTile';
import { ActionCardOverflowMenu } from '../../../actions/ActionCardOverflowMenu';
import type { AgentKind } from '../../agent-kind';
import type { ActionCardModel } from './actionCardsOf';
import { cardIconOf } from './cardIconOf';
import type { CardActions, CardVerb } from './useActionCardActions';

type Props = {
  readonly card: ActionCardModel;
  readonly actions: CardActions;
  readonly isFirst: boolean;
  readonly hasOverflowColumn?: boolean;
  readonly chip?: ReactNode;
};

type VerbButtonParams = {
  readonly verb: CardVerb;
  readonly variant: 'primary' | 'secondary';
  readonly isPickerOpen?: boolean;
  readonly onClick: () => void;
};

const verbButton = ({ verb, variant, isPickerOpen, onClick }: VerbButtonParams) => (
  <Button
    size="sm"
    variant={variant}
    aria-label={verb.ariaLabel}
    aria-expanded={verb.hasPicker ? isPickerOpen : undefined}
    disabled={verb.isDisabled}
    isBusy={verb.isBusy}
    onClick={onClick}
  >
    {verb.label}
  </Button>
);

export const ActionCard = ({ card, actions, isFirst, hasOverflowColumn = false, chip }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState<AgentKind | null>(null);
  const { main, second, failure, menu, foldedTarget } = actions;
  const Icon = cardIconOf({ card });

  useEffect(() => {
    setIsConfirming(false);
    setIsPickerOpen(false);
    setPreviewKind(null);
  }, [card.id]);

  const onMain = () => {
    if (main === null) {
      return;
    }
    if (main.hasPicker) {
      setIsPickerOpen((isOpen) => !isOpen);
      return;
    }
    if (main.confirmRole !== null) {
      setIsConfirming(true);
      return;
    }
    main.run();
  };

  const mainButton =
    main === null
      ? null
      : verbButton({
          verb: main,
          variant: isFirst ? 'primary' : 'secondary',
          isPickerOpen,
          onClick: onMain,
        });

  const mainNode =
    main !== null && main.confirmRole !== null && mainButton !== null ? (
      <ConfirmPopover
        role={main.confirmRole}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        title={`${main.ariaLabel ?? main.label}?`}
        description={card.title}
        confirmLabel={main.label}
        isOpen={isConfirming}
        anchorClassName="flex min-w-0 items-center"
        onConfirm={() => {
          setIsConfirming(false);
          main.run();
        }}
        onCancel={() => setIsConfirming(false)}
        trigger={() => mainButton}
      />
    ) : (
      mainButton
    );

  const overflow =
    menu !== null ? (
      <NextStepMenu
        isBare
        target={menu.target}
        pendingChoiceIds={menu.pendingChoiceIds}
        isHeld={menu.isHeld}
        isDisabled={menu.isDisabled}
        onPreview={setPreviewKind}
        trackChoice={menu.trackChoice}
      />
    ) : foldedTarget !== null ? (
      <ActionCardOverflowMenu target={foldedTarget} label={`More options for ${card.title}`} />
    ) : hasOverflowColumn ? (
      <span aria-hidden className="size-7" />
    ) : null;

  const picker =
    isPickerOpen &&
    card.source.kind === 'suggestion' &&
    card.source.suggestion.kind === 'rebase-project' ? (
      <NextStepRebasePicker
        sessionId={card.source.suggestion.sessionId}
        targets={card.source.suggestion.payload.targets}
        onClose={() => setIsPickerOpen(false)}
      />
    ) : null;

  return (
    <>
      <div
        data-action-card
        data-band={card.band}
        data-testid={`action-card-${card.id}`}
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 rounded-md bg-subtle p-2"
      >
        <NextStepTile
          agentKind={previewKind ?? actions.agentKind}
          fallbackIcon={Icon}
          tone={BAND_TONE[card.band]}
        />
        <div className="flex min-w-0 flex-col">
          <div className="flex min-h-7 min-w-0 items-center gap-2">
            <span className="truncate text-row text-foreground">{card.title}</span>
            {chip}
          </div>
          {card.detail === null ? null : (
            <span className="truncate text-label text-muted-foreground">{card.detail}</span>
          )}
          {failure === null ? null : (
            <span role="alert" className="flex items-center gap-1 text-label text-danger">
              <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{failure}</span>
            </span>
          )}
        </div>
        <HeaderActions
          secondary={
            second === null
              ? null
              : verbButton({ verb: second, variant: 'secondary', onClick: second.run })
          }
          button={isFirst ? null : mainNode}
          primary={isFirst ? mainNode : null}
          overflow={overflow}
        />
      </div>
      {picker}
    </>
  );
};
