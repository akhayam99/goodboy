import { Heart, SquareArrowOutUpRight } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { openLink } from '../../../features/open/openLink';
import { SPONSOR_URL } from '../../../shared/lib/productLinks';

export const SponsorLink = () => (
  <Button
    variant="ghost"
    size="xs"
    onClick={() => openLink({ url: SPONSOR_URL, sessionId: null, place: 'outside' })}
  >
    <Heart size={ICON_SIZE.row} aria-hidden />
    Sponsor on GitHub
    <SquareArrowOutUpRight
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-faint-foreground"
    />
  </Button>
);
