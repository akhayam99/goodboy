import { Archive, Settings } from 'lucide-react';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import { CutTitleRow } from './CutTitleRow';
import { EdgeTooltip } from './EdgeTooltip';

export const TooltipsStage = () => (
  <div data-testid="u30-tooltips" className="fixed inset-0 bg-background">
    <EdgeTooltip className="fixed left-2 top-2" label="Top left corner, opens below" side="top" />
    <EdgeTooltip className="fixed right-2 top-2" label="Top right corner, opens below" side="top" />
    <EdgeTooltip
      className="fixed bottom-2 left-2"
      label="Bottom left corner, opens above"
      side="bottom"
    />
    <EdgeTooltip
      className="fixed bottom-2 right-2"
      label="Bottom right corner, opens above"
      side="bottom"
    />
    <EdgeTooltip
      className="fixed right-2 top-1/2"
      label="Right edge, opens to the left"
      side="right"
    />
    <div className="fixed left-1/2 top-1/3 flex -translate-x-1/2 flex-col items-center gap-6 pb-16">
      <CutTitleRow />
      <div className="flex items-center gap-2">
        <IconButton icon={Archive} label="Archive the agent" iconSize={ICON_SIZE.row} />
        <IconButton icon={Settings} label="Settings" iconSize={ICON_SIZE.row} />
      </div>
    </div>
  </div>
);
