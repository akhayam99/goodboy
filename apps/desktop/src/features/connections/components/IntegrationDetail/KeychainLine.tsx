import { Lock } from '@goodboy/ui/icons';
import { ICON_SIZE } from '@goodboy/ui';

export const KeychainLine = () => (
  <p className="flex items-center gap-2 text-meta text-muted-foreground">
    <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    Stored in your Mac&apos;s keychain. Goodboy has no servers.
  </p>
);
