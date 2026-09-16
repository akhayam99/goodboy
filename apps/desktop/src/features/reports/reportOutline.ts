import { inlineMarkdownText, parseMarkdown } from '@goodboy/ui';

export type ReportOutlineEntry = Readonly<{
  id: string;
  level: number;
  title: string;
}>;

export const REPORT_OUTLINE_MAX_LEVEL = 3;

const slugify = ({ title, index }: { readonly title: string; readonly index: number }): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length === 0 ? `heading-${index}` : `${slug}-${index}`;
};

export const buildReportOutline = ({
  markdown,
}: {
  readonly markdown: string;
}): ReadonlyArray<ReportOutlineEntry> => {
  return parseMarkdown({ text: markdown })
    .blocks.flatMap((block, index) =>
      block.kind === 'heading' && block.level <= REPORT_OUTLINE_MAX_LEVEL ? [{ block, index }] : [],
    )
    .map(({ block, index }) => {
      const title = inlineMarkdownText({ text: block.content });
      return { id: slugify({ title, index }), level: block.level, title };
    });
};
