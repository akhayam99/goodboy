# Readability: speaking names, no comments

Code should read for itself. If a name is clear, no comment is needed. The
zero-comments rule is enforced in [AGENTS.md](../../AGENTS.md) → Code rules.

## Speaking names, never cryptic abbreviations

Variables, parameters and callbacks name the thing they hold. No single-letter or
truncated names.

```ts
// good
const session = data.sessions?.[0];
agents.map((agent) => agent.id);

// bad
const s = data.sessions?.[0];
agents.map((a) => a.id);
```

Exceptions kept short on purpose: the conventional event handler arg `e` and the
state selector arg in store hooks. Everything that holds domain data gets a full
name.

## Zero comments

Comments are not used. Not WHAT, not WHY, not JSDoc. A comment that restates
what the code does is noise; if code needs a comment to be understood, rename
until it speaks for itself.

```ts
// good: the guard reads for itself
if (fetchedAgent !== currentAgent) {
  return;
}

// bad: comment compensating for unclear code
if (a !== b) {
  return; // bail if the agent changed during the fetch
}
```

The only thing left in code is required tooling directives (e.g. the
`/// <reference />` in `vite-env.d.ts`), which are not comments.
