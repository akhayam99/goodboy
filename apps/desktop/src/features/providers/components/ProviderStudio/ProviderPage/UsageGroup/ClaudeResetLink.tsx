import { BAND_ROW_CLASS, Button, cn } from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../../../../../shared/lib/editor';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

const CLAUDE_USAGE_URL = 'https://claude.ai/settings/usage';

export const ClaudeResetLink = () => (
  <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
    <p className="min-w-0 flex-1 text-muted-foreground">
      Claude&apos;s free resets can only be used on claude.ai or in Claude Desktop, not from Claude
      Code. If you have one, it&apos;s in Settings › Usage there.
    </p>
    <Button variant="ghost" size="sm" onClick={() => void openUrl(CLAUDE_USAGE_URL)}>
      Open Claude usage
      <ExternalLink size={ICON_SIZE.row} aria-hidden />
    </Button>
  </div>
);
