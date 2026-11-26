# Local files in a tab

> **Read this when** you change typed local files or the `gblocal` scheme.
> **Not for** the web rule ([host.md](host.md#the-navigation-rule)).

Only an address the user types opens a local file: the address row, ⌘L or ⌘K
Open. It is an absolute path (a drive path such as `C:\work\plan.html` on
Windows), a `~/` path or a `file://` address, to a page, an image or a PDF.
The one other way in is the saved copy of a plan or a report, which the app
opens through [the click rule](doors.md#the-click-rule). A link, a door, a
page, a popup or a frame never opens one; `browser_tab_open` and
`browser_tab_navigate` still refuse `file:`.

## The scheme

Rust serves the file on `gblocal` (`browser/local.rs`), never as `file:`.

1. The pane calls `browser_tab_open_local` or `browser_tab_navigate_local` with
   the typed text.
2. Rust expands `~/`, resolves links, and refuses a missing path
   (`local-missing`), a folder (`local-folder`) or another type (`local-type`).
3. A new tab starts on `about:blank`, gets its grant, then loads the file.

A WebKit `file:` load with folder access would give the web process read access
to the whole tree, hidden files included, with no link check, for the life of
the process; it is also macOS only and untestable headless. The scheme checks
every request, works everywhere and is a pure function under test. The cost:
Tauri counts a page on an app scheme as its own origin (`is_local_url` in
Tauri 2.12), so for a local page the label wall in
[Capabilities](host.md#capabilities) is the only command wall.

## The grant

- A grant belongs to one tab and lives beside it in the registry. Closing the
  tab revokes its grants before the webview closes, so a failed close leaves no
  grant.
- It names the file's folder and a random token. The live address is
  `gblocal://localhost/<token>/<absolute path>` (`http://gblocal.localhost/...`
  on Windows).
- `on_navigation` lets a tab move to a `gblocal` address only with its own token
  and a path inside the folder, so a web page cannot navigate to, frame or
  embed the file. A popup to a local address is refused like any app origin.

## What a request reads

The handler checks the requesting `browse-` label against the grant, then the
path: under the folder, no `..`, no hidden file or folder, links resolved and
checked again, a known type (pages, images, PDF, styles, scripts, fonts, data,
text, video), at most 64 MB.

The checked path is opened one part at a time from the folder with no link
followed (`scoped_path::open_confined`), and type, size and bytes come from
that one handle, so a swap for a link after the check answers 404. On Windows
the open handle's final path must equal the checked path, so a junction swap
answers 404 too. A platform with neither open serves nothing.

Anything else answers 404, and nothing lists a folder. Responses carry
`no-store`, `nosniff`, `no-referrer` and
`Cross-Origin-Resource-Policy: same-origin`.

## How far a grant reaches

- **The page's folder**: every known type, one level.
- **Below it**: only static assets (`ASSET_TYPES`: styles, scripts, source
  maps, fonts, icons, images, wasm, video), never a page, PDF, data or text. A
  site with `index.html` beside `css/`, `js/` and `img/` loads whole, but a
  link to a page in a subfolder does not; type its path.
- **A wide folder**: a grant of its own (`wide_page`) serves the page and the
  static assets beside it, nothing else, so a page saved to Downloads cannot
  read the documents there. Each file opened in a wide folder gets its own
  token.

A wide folder is the home folder or a folder right under it, the top of the
disk or a folder one level down, a folder right under `/Volumes`, `/media` or
`/mnt`, or the top of a mounted volume (a different device on macOS and Linux,
a reparse point on Windows). A folder or parent that cannot be read counts as
wide.

## What the app sees

- Facts, listings and rows carry the `file://` address with its query and
  fragment. The token never leaves Rust.
- The address row shows the path (`C:/work/plan.html` for a Windows drive,
  which opens again), the title comes from the document, and Reload reads the
  file again.
- A closed tab comes back through its grant at the same query and fragment.
  After a restart the row opens again through `browser_tab_open_local`.
- ⌘K Open shows a tab already on the same file. `fileKeyOf` gives a `file://`
  address, its path, a `~/` path and a drive path in either slash the same
  key.
- On Windows paths are compared without the `\\?\` prefix.
- Open in your browser is off for a local tab (`open_url` takes `http` and
  `https` only).

Tests: `browser::local::tests`, `browser::tests` (grant, revoke, return, `file:`
refused on the web path) and `BrowserPane/index.test.tsx`.
