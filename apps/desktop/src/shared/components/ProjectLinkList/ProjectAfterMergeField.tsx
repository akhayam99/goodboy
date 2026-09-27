import { AFTER_MERGE_RULES, type AfterMergeRule, type Project } from '@goodboy/types';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../store/slices/branch-cleanup';
import {
  AFTER_MERGE_LABEL,
  AFTER_MERGE_SHORT_LABEL,
} from '../../../features/settings/components/SettingsStudio/afterMergeCopy';

const INHERIT = 'inherit';

type Choice = AfterMergeRule | typeof INHERIT;

type Props = {
  readonly project: Project;
  readonly busy: boolean;
};

export const ProjectAfterMergeField = ({ project, busy }: Props) => {
  const workspaceRule = useAppStore(
    (state) =>
      state.workspaceOverrides[project.workspaceId]?.afterMerge ?? DEFAULT_AFTER_MERGE_RULE,
  );
  const updateProjectAfterMerge = useAppStore((state) => state.updateProjectAfterMerge);
  const reportError = useAppStore((state) => state.reportError);

  const options: ReadonlyArray<ListboxOption<Choice>> = [
    { value: INHERIT, label: `Same as workspace · ${AFTER_MERGE_SHORT_LABEL[workspaceRule]}` },
    ...AFTER_MERGE_RULES.map((rule) => ({ value: rule, label: AFTER_MERGE_LABEL[rule] })),
  ];

  const choose = async (choice: Choice) => {
    try {
      await updateProjectAfterMerge({
        projectId: project.id,
        afterMerge: choice === INHERIT ? null : choice,
      });
    } catch (error) {
      void reportError({
        title: `Couldn't save what happens after a merge in ${project.name}`,
        error,
      });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-muted-foreground">After merge</span>
      <Listbox
        ariaLabel={`After merge in ${project.name}`}
        size="sm"
        isBlock
        value={project.overrides.afterMerge ?? INHERIT}
        options={options}
        onChange={(choice) => void choose(choice)}
        disabled={busy}
      />
    </div>
  );
};
