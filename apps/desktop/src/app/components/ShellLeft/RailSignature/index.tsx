import { Button, SHELL_RAIL_TILE, Tooltip, cn } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { destinationOf } from '../../../../shared/navigation/destinationOf';
import { useHasUnseenRelease } from '../../../../features/changelog/hooks/useHasUnseenRelease';
import { UnseenReleaseDot } from './UnseenReleaseDot';

const SIGNATURE_PX = 32;

const WHATS_NEW = destinationOf({ id: 'whatsNew' });

type Props = {
  readonly onOpenChangelog: () => void;
};

export const RailSignature = ({ onOpenChangelog }: Props) => {
  const hasUnseenRelease = useHasUnseenRelease();
  const name = hasUnseenRelease ? `${WHATS_NEW.label}, new release notes` : WHATS_NEW.label;
  return (
    <Tooltip content={WHATS_NEW.label} side="right">
      <Button
        variant="quiet"
        size="md"
        aria-label={name}
        data-rail-signature=""
        data-shell-rail-item="signature"
        className={cn('relative shrink-0 items-end px-0', SHELL_RAIL_TILE)}
        onClick={onOpenChangelog}
      >
        <BrandTile size={SIGNATURE_PX} />
        {hasUnseenRelease ? <UnseenReleaseDot /> : null}
      </Button>
    </Tooltip>
  );
};
