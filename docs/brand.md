# Brand

> **Read this when** you are drawing the mascot, the lockup, an app icon, a
> social image or anything else that carries Goodboy's identity. **Not for**
> in-product color, spacing and component rules (see [DESIGN.md](../DESIGN.md))
> or the words inside any of it (see [tone-of-voice.md](./tone-of-voice.md)).

Owns the identity: the mascot, the lockup, and how both survive contact with
surfaces nobody here controls. `DESIGN.md` owns how the product looks while
you use it. This file owns how it is recognised before you have used it.

## The mascot

The canonical asset is a **white-on-transparent PNG**, kept identical in two
places:

- `apps/desktop/src/assets/mascot.png`
- `website/src/assets/mascot.png`

It is never drawn as a coloured image. It is a **mask**, filled by the
surface underneath, which is what `DogMascot` does with a CSS mask and what
every rendered card does with the same mask in CSS. Everything downstream is
one asset and one fill.

The ink inside that PNG is symmetric in its own canvas: the alpha bounding
box leaves 25px left and right and 92px top and bottom of the 512px square.
Centring the mask box centres the mark. Nothing downstream may nudge it.

That single rule is what keeps the dog the same dog in the app, on the site,
in an avatar and in a favicon. It also means a colour change is a token
change, never a new file.

- **Never recolour by exporting a new PNG.** Change the fill.
- **Never rotate, skew, add a shadow, outline or gradient to it.** The mask
  has no room for any of that at 24 px, which is where it lives most often.
- **Never place the glyph beside the wordmark when the mascot is already
  present** in the same frame, as a watermark or as the adjacent avatar. Once
  is identity, twice is clip art.

## The lockup

`website/src/components/Logo.tsx` is the lockup: the mask in white on a black
tile, then the word `Goodboy`. `BrandBadge.tsx` is the same lockup in the app.
No tagline inside it, no registered mark, no second line.

The tile has one geometry everywhere, and it is the only geometry:

| Ratio       | Value   | Meaning                             |
| ----------- | ------- | ----------------------------------- |
| Mark scale  | `0.76`  | Mask box against the tile side      |
| Tile radius | `0.28`  | Corner radius against the tile side |
| Mark inset  | derived | `(1 - 0.76) / 2` on **both** axes   |

The inset is derived, never typed. An offset that differs between the two
axes is a bug: it was one, and it put the mark 3% low on every surface.

**The app icon is the one deliberate exception.** It uses
`APP_ICON_MARK_SCALE_EXCEPTION` in `website/scripts/build-brand-assets.mjs`,
a smaller `0.66`, because the dock renders it between 32 and 64px and the
silhouette needs air to stay readable at that size. Nothing else deviates:
the badge, the site logo and the favicon all take the shared `0.76`, and the
inset is still derived on both axes. Adding a second exception needs a
reason as concrete as that one.

The word is always **Goodboy**, one word, capital G, never `GoodBoy`,
`goodboy` in running text, or an abbreviation. `GB` is not a short form of
anything here.

## Colour

The identity colour is the **accent teal**. The exact value differs by
surface and is owned by tokens, not by this file: `--accent` in
`website/src/styles.css`, the accent ramp in `apps/desktop/src/styles.css`.
Read them, do not retype them.

The tile the mark sits on is **black, never the accent**, and it is one value
across the app, the site, the favicon and the app icon: `--brand-tile` in
`website/src/styles.css` and `--color-brand` in `apps/desktop/src/styles.css`.
The generator refuses to run when those two disagree.

**The tile is meant to disappear in the app, and that is not a defect.**
Against the top bar (`bg-background`) the black tile sits at 1.09:1, so what
the eye reads there is a bare white mark, which is the whole point: the mark
is white on black, not a coloured pill. The mark itself clears 19.66:1, so
nothing is illegible. Do not add a border, a lighter dark-theme tile or a
glow to make the tile visible. On the site and in the dock, where the ground
is white or the icon is standalone, the same tile is doing visible work.

The ground is white on the site and charcoal in the app, and both are
correct. An asset made for one is not automatically valid on the other, so a
social image states which ground it was built on.

## Provider and integration marks

When an asset shows what Goodboy works with, the marks come from the code and
not from a designer's memory: `PROVIDER_IDS` in
`packages/types/src/provider-registry.ts` for the agents, and the integration
union in `packages/types/src/workspace.ts` for the rest. The glyphs
themselves are in `packages/ui/src/components/brandIcons.tsx` and the colours
in the `--color-provider-*` tokens.

Two rules keep a logo row from turning into a partner page:

- **Show a category completely or not at all.** Four of seven providers is a
  claim about which four matter.
- **Label the rows.** `Agents` and `Your work` turn a grid of logos into a
  sentence. Unlabelled, the same marks read as integrations we were approved
  to display.

An asset with such a row carries a date, because the lists move. When a
provider is added, the asset is stale until it is regenerated.

## Social formats

Sizes are what the platform actually renders, not what its help page
suggests. Every one of these is generated, never hand-cropped.

| Surface                     | Size                     | Keep clear                                                                                 |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| X avatar                    | 1024x1024                | Circle crop, so nothing in the corners                                                     |
| X header                    | 1500x500                 | Bottom left, where the avatar overlaps, and the top and bottom edges, which crop on mobile |
| LinkedIn company cover      | 1128x191, rendered at 2x | Bottom left, under the company logo                                                        |
| LinkedIn profile background | 1584x396                 | The left third, under the profile photo                                                    |
| og-image                    | 1200x630                 | Nothing, but crawlers only take the PNG, so the PNG is the only source                     |

A banner is displayed far smaller than it is authored: 1500 px wide becomes
roughly 600 on desktop and 440 on mobile. Anything under about 40 px in the
source is illegible where it is actually seen, which is why the thin
LinkedIn cover carries no marks at all.

## Rendering

Assets are rendered with **system Chrome headless**, from an HTML card that
uses the real tokens and the real mask. There is no puppeteer, imagemagick or
rsvg in this project and none is being added for this.

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=1 \
  --window-size=WxH --screenshot=out.png file:///path/card.html
```

Chrome renders `oklch()` and CSS masks exactly, so the card is the same
colour space the product ships in. Rendering at `--force-device-scale-factor=2`
and letting the platform downscale is the fix for any surface that compresses
hard, which on current evidence is every LinkedIn cover.

`website/scripts/build-brand-assets.mjs` owns every generated surface, the
five social formats above plus `favicon` and `app-icon`. Pass a surface slug
to rebuild one without touching the rest:

```
node scripts/build-brand-assets.mjs app-icon
```

`favicon` writes the whole of `website/public/favicon.svg`, tile and glyph
together, so no attribute in it is hand-maintained. `app-icon` renders a
1024px card and hands it to the Tauri CLI, which emits the PNG set, the
`.icns` and the `.ico` into `apps/desktop/src-tauri/icons`. The CLI orders
`.icns` chunks nondeterministically, so the script compares chunk payloads
rather than bytes and leaves the file alone when only the order moved. Never
hand-paste a binary into that directory: rerun the surface.
