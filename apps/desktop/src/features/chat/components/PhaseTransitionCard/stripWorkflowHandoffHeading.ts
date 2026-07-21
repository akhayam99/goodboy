type Params = {
  readonly context: string;
};

const WORKFLOW_HANDOFF_HEADING = /^[\t ]{0,3}##[\t ]+workflow handoff[\t ]*(?:\r?\n|$)/i;

export const stripWorkflowHandoffHeading = ({ context }: Params) =>
  context.replace(WORKFLOW_HANDOFF_HEADING, '');
