import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { FieldRow, IconButton } from '@goodboy/ui';
import { SettingLevelChip } from './SettingLevelChip';

type Props = {
  readonly label: string;
  readonly help?: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly chip?: string | null;
  readonly isChanged?: boolean;
  readonly onReset?: () => void;
  readonly children: ReactNode;
};

export const SettingRow = ({
  label,
  help,
  layout,
  chip = null,
  isChanged = false,
  onReset,
  children,
}: Props) => {
  const canReset = isChanged && onReset !== undefined;
  const hasMarker = canReset || chip !== null;
  const marker = hasMarker ? (
    <>
      {chip === null ? null : <SettingLevelChip label={chip} />}
      {canReset ? (
        <IconButton
          icon={RotateCcw}
          label={`Reset ${label} to default`}
          tooltip="Reset to default"
          size="xs"
          data-changed-marker=""
          onClick={onReset}
        />
      ) : null}
    </>
  ) : null;
  return (
    <FieldRow label={label} help={help} marker={marker} layout={layout}>
      {children}
    </FieldRow>
  );
};
