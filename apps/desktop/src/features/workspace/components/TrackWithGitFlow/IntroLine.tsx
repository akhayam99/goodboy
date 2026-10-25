import type { FirstCommitPlan } from '@goodboy/types';

type Props = {
  readonly plan: FirstCommitPlan;
};

const authorOf = ({ plan }: Props): string =>
  plan.author.isFallback
    ? `as ${plan.author.name} <${plan.author.email}>, since git has no name and email set on this Mac`
    : `as ${plan.author.name} <${plan.author.email}> from your git settings`;

export const IntroLine = ({ plan }: Props) =>
  plan.start === 'no_git' ? (
    <p className="text-meta text-muted-foreground">
      Goodboy runs <span className="text-code text-foreground">git init</span> on a branch called{' '}
      {plan.branch} and makes a first commit of these files, {authorOf({ plan })}. Nothing leaves
      this Mac: there is no remote until you publish.
    </p>
  ) : (
    <p className="text-meta text-muted-foreground">
      This folder already has git with no commits yet. Goodboy makes a first commit on {plan.branch}{' '}
      of these files, {authorOf({ plan })}. Nothing leaves this Mac: there is no remote until you
      publish.
    </p>
  );
