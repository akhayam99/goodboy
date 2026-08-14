# Readability: speaking names, no comments

> **Read this when** naming a variable, parameter or callback, or you are
> tempted to add a code comment. **Not for** type or parameter naming rules
> (see `docs/typescript/components.md` and `docs/typescript/data.md`).

## Speaking names, never cryptic abbreviations

Variables, parameters and callbacks name the thing they hold. No single-letter or truncated names.

```ts
// good
const session = data.sessions?.[0];
agents.map((agent) => agent.id);

// bad
const s = data.sessions?.[0];
agents.map((a) => a.id);
```

Exceptions kept short on purpose: the conventional event handler arg `e` and the state selector arg in store hooks.

## Why comments are prohibited

The working prohibition and its tooling exception live in
[AGENTS.md](../../AGENTS.md) → Forbidden patterns. The reason is that a
comment that restates what code does becomes noise, while code that needs a
comment to be understood needs names that speak for themselves.

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
