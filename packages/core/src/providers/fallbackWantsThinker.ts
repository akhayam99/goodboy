type Params = {
  readonly role: string;
};

const FALLBACK_THINKING_ROLES: ReadonlySet<string> = new Set(['planner', 'investigator']);

export const fallbackWantsThinker = ({ role }: Params): boolean => {
  return FALLBACK_THINKING_ROLES.has(role);
};
