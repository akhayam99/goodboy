import { useState } from 'react';
import { Eyebrow, ShellRail, ShellRailItem } from '@goodboy/ui';
import type { IconGlyph } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { navEntryToneOf } from '../../../../../../shared/components/navEntryToneOf';
import { ShellRailPlaces } from './ShellRailPlaces';
import { SHELL_RAIL_SCENE_HEIGHT_PX } from './shellRailSceneHeight';

type Tool = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconGlyph;
};

const TOOLS: ReadonlyArray<Tool> = [
  { id: 'terminal', label: 'Terminal', icon: CONCEPT_ICONS.terminal },
  { id: 'browser', label: 'Browser', icon: CONCEPT_ICONS.browser },
  { id: 'monitoring', label: 'Monitor', icon: CONCEPT_ICONS.monitoring },
];

export const ShellRailScene = () => {
  const [current, setCurrent] = useState('board');
  const [openTool, setOpenTool] = useState<string | null>('terminal');
  return (
    <div data-shot className="flex gap-6 bg-background p-6 text-foreground">
      <ShellRailPlaces form="wide" title="Wide" current={current} onSelect={setCurrent} />
      <ShellRailPlaces form="narrow" title="Narrow" current={current} onSelect={setCurrent} />
      <div className="flex flex-col gap-2">
        <Eyebrow label="Tools" />
        <div
          className="rounded-lg border border-border-soft"
          style={{ height: SHELL_RAIL_SCENE_HEIGHT_PX }}
        >
          <ShellRail label="Tools" form="wide">
            {TOOLS.map((tool) => (
              <ShellRailItem
                key={tool.id}
                id={tool.id}
                icon={tool.icon}
                label={tool.label}
                tone={navEntryToneOf({ icon: tool.icon })}
                isPressed={openTool === tool.id}
                onSelect={() => setOpenTool(openTool === tool.id ? null : tool.id)}
              />
            ))}
          </ShellRail>
        </div>
      </div>
    </div>
  );
};
