type PlanText = {
  readonly title: string;
  readonly bodyMd: string;
};

export const planToSource = ({ title, bodyMd }: PlanText): string => {
  const head = title.startsWith('#') ? title : `# ${title}`;
  return bodyMd.length > 0 ? `${head}\n\n${bodyMd}` : head;
};

const isBlank = (line: string): boolean => line.trim().length === 0;

export const parsePlanSource = ({ source }: { readonly source: string }): PlanText => {
  const lines = source.split('\n');
  const firstIndex = lines.findIndex((line) => !isBlank(line));
  if (firstIndex === -1) {
    return { title: '', bodyMd: '' };
  }
  const title = (lines[firstIndex] ?? '')
    .trim()
    .replace(/^#+\s*/, '')
    .trim();
  const rest = lines.slice(firstIndex + 1);
  const start = rest.findIndex((line) => !isBlank(line));
  if (start === -1) {
    return { title, bodyMd: '' };
  }
  const endFromTail = [...rest].reverse().findIndex((line) => !isBlank(line));
  const bodyMd = rest.slice(start, rest.length - endFromTail).join('\n');
  return { title, bodyMd };
};
