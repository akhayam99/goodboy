type NameParams = {
  readonly title: string;
};

type BranchParams = {
  readonly branch: string;
};

type NumberParams = {
  readonly number: number;
};

export const SEND_TO_LEAD_COPY = {
  leadOf: ({ title }: NameParams) => `The Lead of ${title}`,
  sendTo: ({ title }: NameParams) => `Send to the Lead of ${title}`,
  holdsPr: ({ number }: NumberParams) => `Holds #${number}`,
  holdsComment: 'Holds this comment',
  ranPlan: 'Ran this plan',
  workedCheck: 'Worked on this check',
  onBranch: ({ branch }: BranchParams) => `Works on ${branch}`,
  sameSession: 'In this session',
  sameProject: 'In this project',
  hasIt: ({ title }: NameParams) => `The Lead of ${title} has it`,
  isOnIt: ({ title }: NameParams) => `The Lead of ${title} is on it`,
  newLeadOn: ({ branch }: BranchParams) => `New Lead on ${branch}`,
  newLead: 'New Lead',
  notDelivered: 'Not delivered: the Lead stopped',
  notSaved: "The message couldn't be saved, so it was not sent.",
  leadNotFound: "The Lead couldn't be found, so the message was not sent.",
  notTakenBack: "The message couldn't be taken back. It is still with the Lead.",
  pickNote: 'Add a note for the Lead',
  pickTitle: 'Send to which Lead?',
  notReadYet: 'Not read yet',
  starting: 'Starting',
  edit: 'Edit',
  undo: 'Undo',
} as const;
