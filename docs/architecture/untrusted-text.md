# Untrusted text

> **Read this when** text a stranger wrote (a model reply, an issue, a ticket,
> a check log, a page in a browser tab) reaches a prompt, a renderer, a lookup
> table or a network fetch. **Not for** how to report a vulnerability
> ([SECURITY.md](../../SECURITY.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## In a prompt

Issue and ticket text, check names, check logs, file paths and PR text reach a
prompt only through `untrustedBlock({ source, text })` in `packages/core`. It
prints a line naming the source and saying the text is evidence only, then the
text in a fence longer than any backtick run inside it, so the text cannot
close its own block. It frames the text; the boundary stays the permission
mode.

The issue brief and the check analysis builders use it, with a test per
builder that fails when a host word lands outside a block. A new builder that
puts host text in a prompt calls it too.

## In the renderer

- **Callouts.** `parseMarkdown` opens at most six nested `<<tag>>` callouts
  (`MAX_CALLOUT_DEPTH`); a seventh stays plain text, so
  `'<<note>>'.repeat(2500)` cannot overflow the stack.
- **Tables.** The divider is checked cell by cell, not with a regex that
  backtracks.
- **A throw.** `Markdown` logs it and shows that block's raw text in a `<pre>`;
  the rest of the window stays alive, and the next text parses again.
- **Redaction.** The `redactReport` patterns over a stranger's text (URL
  scheme, scp remote, email) bound every repeat.

A new pattern over untrusted text bounds its repeats and gets a
pathological-input case in a perf test (`MarkdownDepth.test.tsx`,
`redactReport.perf.test.ts`).

## In a lookup table

A key a model or a host controls is looked up with `ownValue({ table, key })`
in `packages/core`, which reads through `Object.hasOwn`, so `constructor`,
`__proto__` and `toString` answer `undefined`. The wireframe near tables (the
enum gate the frame trusts), the GitLab job conclusions, the GitHub review
decisions and the Claude rate limit status and window tables use it, each with
a test that feeds the inherited names. Pattern expansion copies keys with
`Object.fromEntries`, so a `__proto__` key stays data. A new table keyed by an
outside string uses `ownValue` or a `Map`.

## In a remote image fetch

`remote_image.rs` refuses these ranges, for the address given and for every
address a DNS answer gives, before the client is pinned to them:

- **IPv4:** `0.0.0.0/8`, loopback, private, link-local, `100.64.0.0/10`,
  `192.0.0.0/24`, `192.88.99.0/24`, `198.18.0.0/15`, documentation, multicast
  and `240.0.0.0/4`.
- **IPv6:** unique local, link-local, the deprecated site-local `fec0::/10`,
  loopback, multicast, NAT64 (`64:ff9b::/32`), 6to4 (`2002::/16`), Teredo
  (`2001::/32`), documentation (`2001:db8::/32`), discard (`100::/64`) and the
  `::/96` IPv4-compatible block. An IPv4-mapped address takes the IPv4 rules.

The table tests in `remote_image.rs` pin each range and its public neighbours;
a new range changes both lists.

- **No proxy.** `build_media_client` sets `no_proxy()`, so a proxy cannot
  resolve the host again and reach a refused address
  (`the_media_client_never_routes_through_a_proxy`).
- **One deadline.** A fetch, a probe and a video (`remote_media.rs`) each take
  one `Deadline` (15 s, 180 s for a video) over the DNS lookup, the first
  request, the one GitHub redirect and the streamed body. A redirect gets what
  is left, and a lookup also stops after 5 s (`DNS_TIMEOUT`).

## In a browser tab

The page runtime (`browser/page_runtime/`, joined by `console::tab_script`)
keeps console lines, requests and errors in separate rings in the page. Rust
parses every read as untrusted: each entry on its own, every field capped, the
sensitive headers dropped again (`console::SENSITIVE_HEADERS`). Picked elements
are page data too (`pick::pick_answer_of` caps every field), and the note about
them is typed in the app ([browser.md](../browser.md) → Console and Pick an
element).
