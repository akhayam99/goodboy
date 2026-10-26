import { Chip } from '@goodboy/ui';

type Props = {
  readonly label: string;
};

export const SettingLevelChip = ({ label }: Props) => (
  <Chip tone="neutral" kind="state" emphasis="subtle" label={label} />
);
