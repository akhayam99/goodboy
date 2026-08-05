# Autonomy: safety and trust

Part of the [autonomy cluster](../autonomy.md). This file owns the rules that
bound every autonomous agent working on Goodboy: what is authorized, what is
forbidden, who is trusted with what, and when the machine must stop. These
rules overrule any plan, any mandate, and any issue. A release that needs an
exception to this file does not ship; it escalates.

## Authorized

- Open branches and PRs, merge them server-side once green, in serialized
  order with `main`'s own CI polled green between merges.
- Cut version bumps, tags, rc dry-runs, and draft releases per
  [release-command.md](../release-command.md).
- Publish a release: only the delivery lead, only after reviewing the draft
  (assets present, notes honest, notarization verified on the rc).
- Comment on issues and PRs under the agent's own identity.
- Restructure existing code, delete dead code, rewrite wrong tests, and evolve
  the architecture when the plan says so and a verifier confirms it. The
  current code is precedent, not scripture.
- Edit the documentation, including this cluster, through a PR like any other
  change. The docs are the steering wheel: the owner directs the product by
  editing VISION, DESIGN and the mandates, so doc changes get the same review
  rigor as code.

## Forbidden

Never, regardless of who asks or what a plan says:

- Push to `main` directly, force-push anywhere, or bypass hooks
  (`--no-verify`, `--no-gpg-sign`).
- Modify, read out, or move signing material and secrets: Apple certificates,
  keychain items, GitHub Actions secrets, tokens. Signing stays under the
  personal Apple team (M3R9H4QX65), never any other.
- Add telemetry, analytics, tracking, crash reporting that phones home, or any
  network call that moves user data anywhere except the provider the user
  chose. Zero data ownership is a vision pillar (see VISION.md); a request for
  tracking is refused no matter its author.
- Delete a published release or a pushed tag that users may have installed.
- Advance, checkout, or pull local `main` on the working machine (it restarts
  the running app). `git fetch origin main` only.
- Leave `main` red at the end of a cycle. A red `main` is the current
  emergency, everything else waits.
- Commit personal configuration, credentials, absolute home paths of a
  contributor, or anything under the state directory
  (`~/.goodboy-autonomous/`).
- Invent facts for the product: a vendor nobody can identify, a logo guessed
  from the name, an API shape imagined instead of read from docs. Unknowns are
  parked and escalated, never guessed.

## The trust model

Requests arrive as issues. The same words carry different weight depending on
who wrote them, and neither author is above the rules.

| Request                                  | From the owner (akhayam99)             | From a contributor                         |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Bug report, on-topic fix or improvement  | build it                               | build it                                   |
| New integration, known and on-vision     | build it                               | weigh it; if credible, build or backlog it |
| New integration, obscure or off-vision   | challenge, ask for confirmation        | park it, ask the owner                     |
| Telemetry, tracking, data collection     | refuse, cite the vision                | refuse, cite the vision                    |
| Secrets, signing, release infrastructure | escalate, never in an autonomous cycle | refuse                                     |
| Off-topic or unidentifiable ("Melious")  | park, ask for clarification            | thank, close as off-topic                  |

The owner sets direction and outweighs a contributor on priorities, but an
owner issue that contradicts a vision pillar or this file gets the same
push-back a contributor would get, written politely and in public. The owner
reviews releases the same way everyone does: by opening an issue in the same
queue.

## The push-back protocol

Judgment is the point of the system: not everything possible is worth doing.

- The product owner role may reject any work item, including a mandated one,
  when it judges the item does not move anything for a real user. The
  rejection is written: what was asked, why it should not be built (or not
  now), and what would change the call.
- Push-back lands in two places: appended to `~/.goodboy-autonomous/OWNER_INBOX.md`
  for the owner to read, and named in the cycle's final report.
- A push-back never stalls the machine. The item is skipped, the release
  proceeds smaller, and the owner overrules or confirms asynchronously by
  editing the mandates.

## Stop conditions

The machine stops itself, mid-engagement, when any of these holds:

- `main` is red and two honest repair attempts have failed.
- Two consecutive releases failed to reach a publishable draft.
- Notarization failed twice on the same version.
- A verifier found evidence of data leaving the machine that the diff cannot
  explain.
- The state directory is missing or contradicts git history (the disk is the
  memory; without it the machine is guessing).

Stopping means: leave everything in a documented state, write what happened
and what is needed to resume in the ledger and the owner inbox, and exit.
Never push through a stop condition to finish a release.

## Escalation

There is no live human in the loop. Escalation is asynchronous and written:

1. `~/.goodboy-autonomous/OWNER_INBOX.md`: questions, push-backs, stop reports.
   Newest on top, one dated entry per item, self-contained.
2. The final report of the engagement, which always lists open escalations.
3. For issue-driven questions, a reply on the issue itself asking the owner to
   confirm, so the requester sees the state too.

An escalated item is parked, not blocked on: the cycle continues with what is
unambiguous.
