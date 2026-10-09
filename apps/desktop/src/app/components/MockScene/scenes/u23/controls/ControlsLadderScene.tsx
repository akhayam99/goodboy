import { Pin, RefreshCw, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  IconButton,
  SegmentedTabs,
  type ButtonSize,
  type ButtonVariant,
} from '@goodboy/ui';
import { SceneFrame } from './SceneFrame';
import { SceneRow } from './SceneRow';

const VARIANTS: ReadonlyArray<ButtonVariant> = [
  'primary',
  'secondary',
  'ghost',
  'quiet',
  'danger',
  'ghost-danger',
];

const SIZES: ReadonlyArray<ButtonSize> = ['xs', 'sm', 'md'];

export const ControlsLadderScene = () => (
  <SceneFrame>
    {SIZES.map((size) => (
      <SceneRow key={size} name={`Button ${size}`}>
        {VARIANTS.map((variant) => (
          <Button key={variant} size={size} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button size={size} variant="primary" disabled>
          Disabled
        </Button>
        <Button size={size} variant="secondary" disabled>
          Disabled
        </Button>
        <Button size={size} variant="ghost" disabled>
          Disabled
        </Button>
      </SceneRow>
    ))}
    <SceneRow name="Icon buttons xs, sm, md">
      <IconButton size="xs" icon={Pin} label="Pin Harborline ledger" />
      <IconButton size="sm" icon={RefreshCw} label="Refresh payments-api" />
      <IconButton size="md" icon={Trash2} label="Delete notify-relay" tone="danger" />
      <IconButton size="sm" icon={Pin} label="Pin Northwind" variant="outline" />
      <IconButton size="sm" icon={Pin} label="Unavailable" disabled />
    </SceneRow>
    <SceneRow name="Chips by kind">
      <Chip kind="state" tone="success" label="Merged" />
      <Chip kind="state" tone="warning" label="Needs you" />
      <Chip kind="state" tone="neutral" label="Draft" />
      <Chip kind="reference" tone="neutral" as="button" label="Context" />
      <Chip kind="reference" tone="neutral" as="button" label="#318" onClick={() => undefined} />
      <Chip kind="id" tone="neutral" label="a1b2c3d" />
      <Chip kind="count" tone="primary" label="3" />
    </SceneRow>
    <SceneRow name="Header action row">
      <SegmentedTabs
        size="xs"
        ariaLabel="View"
        value="board"
        onChange={() => undefined}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'list', label: 'List' },
        ]}
      />
      <Button size="sm" variant="secondary">
        Create pull request
      </Button>
      <IconButton size="sm" icon={RefreshCw} label="Refresh ledger-core" />
    </SceneRow>
    <SceneRow name="List row actions">
      <span className="text-label text-foreground">ledger-core / fix posting rounding</span>
      <Button size="xs" variant="ghost">
        Open
      </Button>
      <Button size="xs" variant="ghost-danger">
        Unlink
      </Button>
      <IconButton size="xs" icon={Pin} label="Pin fix posting rounding" />
    </SceneRow>
    <SceneRow name="Toolbar">
      <IconButton size="sm" icon={RefreshCw} label="Refresh notify-relay" />
      <IconButton size="sm" icon={Pin} label="Pin notify-relay" />
      <Button size="sm" variant="quiet">
        Filters
      </Button>
      <Button size="sm" variant="primary">
        New session
      </Button>
    </SceneRow>
  </SceneFrame>
);
