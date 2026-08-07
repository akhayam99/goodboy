import { ExternalLink } from 'lucide-react';
import { Button, Chip, Popover, cn } from '@goodboy/ui';
import { useDropdown } from '../../hooks/useDropdown';
import { DropdownPortal } from '../../hooks/useDropdown/DropdownPortal';
import { openUrl } from '../../lib/editor';

const SPONSOR_URL = 'https://github.com/sponsors/akhayam99';

type Props = {
  readonly className?: string;
};

export const BetaPill = ({ className }: Props) => {
  const { open, toggle, containerRef, popupRef, popupClassName, popupStyle, portal, portalTarget } =
    useDropdown({
      align: 'start',
      expectedHeight: 132,
      expectedWidth: 288,
      width: 'w-72',
      strategy: 'fixed',
    });

  const openSponsorPage = () => {
    void openUrl(SPONSOR_URL);
  };

  return (
    <div ref={containerRef} className="relative">
      <Chip
        as="button"
        tone="primary"
        label="Beta"
        onClick={toggle}
        testId="beta-badge-trigger"
        className={cn(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          className,
        )}
      />
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel="Support Goodboy"
            className={cn(popupClassName, 'flex flex-col gap-3 p-3')}
            style={popupStyle}
          >
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Goodboy is free and open source. A sponsorship helps keep it maintained.
            </p>
            <Button size="sm" onClick={openSponsorPage} className="self-start">
              <ExternalLink size={12} aria-hidden />
              Sponsor on GitHub
            </Button>
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
