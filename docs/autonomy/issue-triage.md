# Autonomy: issue triage

Part of the [autonomy cluster](../autonomy.md). This file owns the issue loop:
how open issues are read, decided, answered and fed into releases. The trust
model that weighs authors lives in [safety.md](./safety.md); the labels live
in CONVENTIONS.md.

The contract: **no issue goes dark.** Every open issue gets a decision and a
written reply every release cycle, even when the decision is "not yet".

## The loop

Run by the issue triage officer ([roles.md](./roles.md)) on two cadences:

- **Continuous**: while an engagement runs, a cheap checker polls the issue
  list roughly every 30 minutes for new issues and new comments, and triages
  anything new.
- **Per release**: before each release is cut, sweep every open issue. Any
  issue whose state changed (taken, shipped, parked, still pending) gets a
  follow-up comment saying so. An issue answered last cycle and unchanged
  since needs no new comment; silence after a decision is fine, silence
  instead of a decision is not.

## The decision tree

For each new or changed issue, in order:

1. **Is it dangerous or forbidden?** Tracking, secrets, release infra,
   anything in safety.md's forbidden list. Refuse politely, cite the vision or
   the policy, close. Owner-authored: refuse the same way but leave it open
   with a question, the owner may be probing direction.
2. **Is it off-topic or unidentifiable?** Thank the author, say why it does
   not fit, ask them to tag the owner if they believe it deserves a second
   look. Close. If the author is the owner, park it open and ask for
   clarification instead.
3. **Is it a bug?** Confirm it is reproducible from the report (or say what is
   missing), label it, set a priority, and either queue it for the current
   cycle's body work or backlog it with an honest "when".
4. **Is it a credible feature or integration request?** Weigh it against
   VISION and the backlog. Known, used, on-vision: accept and backlog (or take
   it this cycle if it fits the theme). Plausible but uncertain: reply with
   the open questions and escalate to the owner per safety.md.
5. **Is it a good point that is not actionable now?** Say exactly that, and
   what would make it actionable. Keep it open with the right labels.

Preliminary replies fill what the author left out: type and priority labels, a
one-line restatement of the problem so mislabeling surfaces early, and whether
it needs the owner's call. The responder proposes, the triage officer reviews
against the trust model, then posts.

## Voice and identity

Replies are written in the repo's [tone of voice](../tone-of-voice.md):
direct, concrete, no fluff, honest about limits. Warm to first-time
reporters; "this feels off" is a valid bug report here and the reply treats it
as one.

Replies are posted under the agent's own account, never impersonating the
owner. The reader must always be able to tell what the owner wrote personally
from what the delivery organization wrote. If the posting account is not
visibly a bot, the reply ends with a short plain line:

> Triaged by Goodboy's own delivery loop. Amin reads these too, tag
> @akhayam99 to pull him in.

Adapt the tail to the fact, keep it one line, and never fake a human identity.

## From issue to work

- Accepted items land in `~/.goodboy-autonomous/BACKLOG.md` with the issue
  number, so the next release captain sees them in Phase 1 with provenance.
- A PR that resolves an issue says `Closes #N`, and the triage sweep comments
  on the issue when the fix ships in a published release, naming the version.
- Priorities: a confirmed regression outranks a feature request; a request
  from the owner outranks a same-sized request from a contributor; neither
  outranks a stop condition or the safety file.

## What triage never does

- Never merges or writes code. Triage decides and routes; building belongs to
  a release cycle.
- Never promises dates. It promises the next decision point.
- Never argues in more than two rounds on a closed question. After two, the
  reply is "escalated to the owner" and the thread waits for a human.
- Never deletes or edits someone else's comment, never locks a thread unless
  it is abusive.
