type Params = Readonly<{
  id: string;
  revision: number | null;
  bodyMd: string;
}>;

export const renderCurrentPlan = ({ id, revision, bodyMd }: Params): string => {
  const revisionAttribute = revision === null ? '' : ` revision="${revision}"`;
  return [
    `[current-plan id="${id}"${revisionAttribute}]`,
    'This is the plan you wrote. It is the source of truth, not your memory of it.',
    'If the user asks for a change to it, write the whole updated plan as one plan block, never a patch.',
    '',
    bodyMd.trim(),
    '[/current-plan]',
  ].join('\n');
};
