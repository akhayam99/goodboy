import { GitBranch, Pin, RefreshCw, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  ICON_SIZE,
  IconButton,
  TEXT_ROLE,
  type ButtonSize,
  type ChipSize,
} from '@goodboy/ui';
import { Frame } from './Frame';
import { Section } from './Section';
import { ROW_HEIGHTS } from './rowHeights';

const BUTTON_SIZES: ReadonlyArray<ButtonSize> = ['xs', 'sm', 'md'];
const CHIP_SIZES: ReadonlyArray<ChipSize> = ['3xs', 'xs', 'sm', 'md', 'control'];

export const ControlsScaleScene = () => (
  <Frame>
    <Section title="Button">
      <div className="flex flex-wrap items-center gap-2">
        {BUTTON_SIZES.map((size) => (
          <Button key={size} size={size} variant="secondary">
            {`Button ${size}`}
          </Button>
        ))}
      </div>
    </Section>
    <Section title="Icon button">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton size="xs" icon={Pin} label="Pin Harborline ledger" />
        <IconButton size="sm" icon={RefreshCw} label="Refresh payments-api" />
        <IconButton size="md" icon={Trash2} label="Delete notify-relay" tone="danger" />
      </div>
    </Section>
    <Section title="Chip">
      <div className="flex flex-wrap items-center gap-2">
        {CHIP_SIZES.map((size) => (
          <Chip key={size} size={size} tone="neutral" label={`Chip ${size}`} />
        ))}
      </div>
    </Section>
    <Section title="Row">
      <ul className="flex flex-col gap-1">
        {ROW_HEIGHTS.map((row) => (
          <li
            key={row.px}
            className={`flex ${row.height} items-center gap-2 rounded-md px-2 text-label hover:bg-hover`}
          >
            <GitBranch size={ICON_SIZE.row} aria-hidden className={TEXT_ROLE.secondary} />
            <span className="min-w-0 flex-1 truncate text-foreground">
              {`Row ${row.px}px, Northwind release`}
            </span>
            <Button size="xs" variant="ghost">
              Open
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  </Frame>
);
