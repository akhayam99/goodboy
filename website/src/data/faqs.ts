export type FaqItem = {
  readonly question: string;
  readonly answer: string;
};

export const FAQS: readonly FaqItem[] = [
  {
    question: 'Do I need to be a developer?',
    answer:
      'Goodboy is at its best on a code project, where a task can end in a branch, a diff and a pull request. Point it at a plain folder and agents still work on it.',
  },
  {
    question: 'Is it really free?',
    answer: 'Yes. Goodboy is a free desktop app, with no account to create.',
  },
  {
    question: 'Will it cost me anything on top of what I already pay?',
    answer:
      'No new bill from Goodboy. Agents run on the providers you connect, with the plan or key you already have.',
  },
  {
    question: 'Where does my data go?',
    answer:
      'Your tasks, decisions and settings stay on your computer. Your prompts go from you to the provider you picked.',
  },
  {
    question: 'Which platforms does it run on?',
    answer:
      'macOS and Linux. Download the Mac app from this page, the Linux builds are on the release page.',
  },
];
