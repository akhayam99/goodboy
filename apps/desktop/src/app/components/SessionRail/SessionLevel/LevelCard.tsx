import { useId, type ReactNode } from 'react';
import { Band, Reveal } from '@goodboy/ui';
import { ContextCardHead } from '../../../../features/session/components/ContextDrawer/ContextCardHead';
import { CONTEXT_CARD_BODY } from '../../../../features/session/components/ContextDrawer/contextCardBody';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly count?: number;
  readonly meta?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const LevelCard = ({
  id,
  label,
  isOpen,
  onToggle,
  count,
  meta,
  action,
  children,
}: Props) => {
  const bodyId = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      data-level-card={label}
      data-context-block={label}
      data-open={isOpen ? '' : undefined}
      className="min-w-0"
    >
      <Band className="min-w-0">
        <ContextCardHead
          label={label}
          headingId={id}
          count={count}
          meta={isOpen ? undefined : meta}
          actions={action}
          fold={{ isOpen, bodyId, onToggle }}
        />
        <Reveal open={isOpen} id={bodyId}>
          <div className={CONTEXT_CARD_BODY.treeRows}>{children}</div>
        </Reveal>
      </Band>
    </div>
  );
};
