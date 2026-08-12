import { Markdown, SectionHeader } from '@goodboy/ui';

type Props = {
  readonly summary: string | undefined;
};

export const WorkflowRunSummary = ({ summary }: Props) => {
  const text = summary?.trim() ?? '';
  if (text === '') {
    return null;
  }

  return (
    <section
      data-testid="workflow-run-summary"
      aria-label="Recap"
      className="flex min-w-0 flex-col gap-1.5"
    >
      <SectionHeader label="Recap" />
      <Markdown text={text} className="text-2xs leading-relaxed" />
    </section>
  );
};
