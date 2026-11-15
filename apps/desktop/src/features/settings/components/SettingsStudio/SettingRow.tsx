import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { FieldRow, IconButton } from '@goodboy/ui';
import type { SettingSave } from '../../hooks/useSettingSave';
import { useSettingRowAnchor } from '../../hooks/useSettingRowAnchor';
import { SaveErrorHelp } from './SaveErrorHelp';
import { SettingLevelChip } from './SettingLevelChip';

type Props = {
  readonly label: string;
  readonly rowKey?: string;
  readonly help?: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly chip?: string | null;
  readonly isChanged?: boolean;
  readonly onReset?: () => void;
  readonly save?: Pick<SettingSave<unknown>, 'error' | 'isSaving' | 'retry'>;
  readonly children: ReactNode;
};

export const SettingRow = ({
  label,
  rowKey,
  help,
  layout,
  chip = null,
  isChanged = false,
  onReset,
  save,
  children,
}: Props) => {
  const anchor = useSettingRowAnchor({ rowKey: rowKey ?? '' });
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
  const hasError = save !== undefined && save.error !== null;
  return (
    <FieldRow
      ref={anchor.ref}
      anchor={rowKey}
      label={label}
      help={hasError ? <SaveErrorHelp help={help} save={save} /> : help}
      marker={marker}
      layout={layout}
      isHighlighted={anchor.isHighlighted}
    >
      {children}
    </FieldRow>
  );
};
