type Params = {
  readonly title: string;
  readonly detail: string | null;
};

export const talkItThroughGoal = ({ title, detail }: Params): string =>
  [
    'Talk this through with me before you start any work. Guide me and suggest options.',
    '',
    detail === null || detail.trim() === '' ? title : `${title}\n${detail.trim()}`,
  ].join('\n');
