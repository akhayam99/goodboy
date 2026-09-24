import { ExternalLink } from 'lucide-react';
import { AnchoredPopover, Button, Chip, cn, useDropdown, tintClasses } from '@goodboy/ui';
import { openUrl } from '../../lib/editor';

const SPONSOR_URL = 'https://github.com/sponsors/akhayam99';
const TRIGGER_LABEL = 'Beta build, open the sponsor panel';
const PRIMARY_TINT = tintClasses('primary');

type Props = {
  readonly className?: string;
};

export const BetaPill = ({ className }: Props) => {
  const dropdown = useDropdown({
    align: 'center',
    expectedHeight: 132,
    expectedWidth: 288,
    width: 'w-72',
  });
  const { toggle } = dropdown;

  const openSponsorPage = () => {
    void openUrl(SPONSOR_URL);
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Support Goodboy"
      className="flex flex-col gap-2.5 p-3.5"
      anchorClassName="flex"
      trigger={
        <Chip
          as="button"
          tone="neutral"
          size="sm"
          ariaLabel={TRIGGER_LABEL}
          label={
            <span className="flex items-center gap-1.5">
              <span className="font-semibold">Beta</span>
              <span aria-hidden className="h-3 w-px self-center bg-current opacity-40" />
              <span className="font-medium">Sponsor</span>
            </span>
          }
          onClick={toggle}
          testId="beta-badge-trigger"
          className={cn(
            PRIMARY_TINT.hoverBgSoft,
            PRIMARY_TINT.hoverText,
            'focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            className,
          )}
        />
      }
    >
      <p className="text-xs font-semibold leading-snug text-foreground">Goodboy is in beta</p>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Releases land often, so expect rough edges. The app is free and source-available, and a
        sponsorship pays for the time that goes into it.
      </p>
      <Button size="sm" onClick={openSponsorPage} className="self-start">
        <ExternalLink size={12} aria-hidden />
        Sponsor on GitHub
      </Button>
    </AnchoredPopover>
  );
};
