import type { Project } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { levelChipLabel } from '../../settingLevel/levelChipLabel';
import { levelOfSetting } from '../../settingLevel/levelOfSetting';
import { SettingLevelChip } from './SettingLevelChip';

type Props = {
  readonly project: Project;
};

export const ProjectAfterMergeChip = ({ project }: Props) => {
  const chipLabel = useAppStore((state) =>
    levelChipLabel({
      level: levelOfSetting({
        key: 'afterMerge',
        workspaceOverride: state.workspaceOverrides[project.workspaceId] ?? null,
        projectOverride: project.overrides,
        sessionOverride: null,
      }),
    }),
  );
  return chipLabel === null ? null : <SettingLevelChip label={chipLabel} />;
};
