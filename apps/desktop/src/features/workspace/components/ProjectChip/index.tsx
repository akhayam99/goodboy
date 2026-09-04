import { Chip, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly projectNames: ReadonlyArray<string>;
};

export const ProjectChip = ({ projectNames }: Props) => {
  if (projectNames.length === 0) {
    return null;
  }
  if (projectNames.length === 1) {
    return (
      <Chip
        tone="neutral"
        size="3xs"
        bordered={false}
        label={<span className="max-w-[12ch] truncate">{projectNames[0]}</span>}
        ariaLabel={`Project: ${projectNames[0]}`}
        className="max-w-[14ch] shrink-0"
      />
    );
  }
  const label = `${projectNames.length} projects`;
  return (
    <Tooltip content={projectNames.join(', ')} side="top">
      <Chip
        tone="neutral"
        size="3xs"
        bordered={false}
        icon={<CONCEPT_ICONS.mount size={10} aria-hidden />}
        label={label}
        ariaLabel={`${label}: ${projectNames.join(', ')}`}
        className="shrink-0"
      />
    </Tooltip>
  );
};
