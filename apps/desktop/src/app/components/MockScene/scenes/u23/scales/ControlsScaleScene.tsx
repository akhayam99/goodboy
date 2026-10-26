import { GitBranch, Pin, RefreshCw, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  ICON_SIZE,
  IconButton,
  Meter,
  TEXT_ROLE,
  type ButtonSize,
  type ChipKind,
} from '@goodboy/ui';
import { Frame } from './Frame';
import { Section } from './Section';
import { ROW_HEIGHTS } from './rowHeights';

const BUTTON_SIZES: ReadonlyArray<ButtonSize> = ['xs', 'sm', 'md'];
const CHIP_KINDS: ReadonlyArray<ChipKind> = ['state', 'reference', 'id', 'count'];

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
        {CHIP_KINDS.map((kind) => (
          <Chip key={kind} kind={kind} tone="neutral" label={`Chip ${kind}`} />
        ))}
      </div>
    </Section>
    <Section title="Meter">
      <div className="flex flex-col gap-2">
        <Meter size="xs" label="Cache reuse for Harborline" value={42} />
        <Meter label="Saved versions of ledger-core" value={18} max={60} />
        <Meter label="Spent on payments-api" value={92} tone="warning" />
      </div>
    </Section>
    <Section title="Row">
      <ul className="flex flex-col gap-1">
        {ROW_HEIGHTS.map((row) => (
          <li
            key={row.px}
            className={`flex ${row.height} items-center gap-2 rounded-md px-2 text-meta hover:bg-hover`}
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
