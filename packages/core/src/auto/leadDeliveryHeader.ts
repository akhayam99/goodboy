export const LEAD_DELIVERY_HEADER = {
  delta:
    'ONLY WHAT CHANGED SINCE YOUR LAST MESSAGE\nEverything you were told before still holds: the protocol, the models, the shared context, the budget, the mounts, and the artifacts and agents not named below. A line below replaces the line with the same id. A section marked THE WHOLE LIST NOW replaces that section entirely, so an entry it leaves out is gone. A section marked NOW EMPTY clears what you were told under it.',
  fresh:
    'NEW SESSION\nThis is a new session of this conversation, so your earlier turns are not here. What you need is below: the goal and the decisions in the shared context, the open agents, the artifacts and the budget. Continue from it; do not start the work again.',
} as const satisfies Readonly<Record<'delta' | 'fresh', string>>;
