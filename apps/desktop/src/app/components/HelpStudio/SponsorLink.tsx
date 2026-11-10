import { Heart, SquareArrowOutUpRight } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { openUrl } from '../../../shared/lib/editor';
import { SPONSOR_URL } from '../../../shared/lib/productLinks';

export const SponsorLink = () => (
  <Button
    variant="ghost"
    size="xs"
    onClick={() => {
      void openUrl(SPONSOR_URL);
    }}
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
