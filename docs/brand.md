# Brand

> **Read this when** you are drawing the mascot, the lockup, an app icon, a
> social image or anything else that carries Goodboy's identity. **Not for**
> in-product color, spacing and component rules (see [DESIGN.md](../DESIGN.md))
> or the words inside any of it (see [tone-of-voice.md](./tone-of-voice.md)).

This file covers the identity: the mascot, the lockup, and how both hold up on
screens nobody here controls. `DESIGN.md` covers how the product looks while
you use it. This file covers how people recognise it before they have used it.

## The mascot

The one true asset is a **white-on-transparent PNG**. The same file lives in
two places:

- `apps/desktop/src/assets/mascot.png`
- `website/src/assets/mascot.png`

It is never drawn as a coloured image. It is a **mask**: the surface
underneath fills it with colour. `DogMascot` does this with a CSS mask, and
every rendered card uses the same mask in CSS. So everything comes from one
asset and one fill.

The drawing inside that PNG sits in the exact middle of its canvas. In the
512px square, the visible part leaves 25px on the left and right, and 92px at
the top and bottom. Centre the mask box and the mark is centred. Nothing that
uses it may nudge it.

That single rule keeps the dog the same dog in the app, on the site, in an
avatar and in a favicon. It also means a colour change is a token change,
never a new file.

- **Never recolour by exporting a new PNG.** Change the fill.
- **Never rotate, skew, add a shadow, outline or gradient to it.** At 24 px,
  where it shows up most often, the mask has no room for any of that.
- **Never place the glyph beside the wordmark when the mascot is already
  present** in the same frame, as a watermark or as the avatar next to it.
  Once is identity, twice is clip art.

## The lockup

`website/src/components/Logo.tsx` is the lockup: the mask in white on a black
tile, then the word `Goodboy`. It has no tagline, no registered mark and no
second line.

In the app chrome the mark drops the tile. The chrome draws the bare glyph in
`text-foreground`, so it is light on the dark theme and dark on the
light theme, next to the same word. The mask file and its ratios do not
change. This is the title bar convention of Linear, Cursor and Arc: a
monochrome glyph in the chrome, the tile on the dock icon.

The tile has one shape everywhere, and no other shape exists:

| Ratio       | Value   | Meaning                             |
| ----------- | ------- | ----------------------------------- |
| Mark scale  | `0.76`  | Mask box against the tile side      |
| Tile radius | `0.28`  | Corner radius against the tile side |
| Mark inset  | derived | `(1 - 0.76) / 2` on **both** axes   |

The inset is calculated, never typed in. If the offset differs between the two
axes, that is a bug. It happened once, and it put the mark 3% too low on every
surface.

**The app icon is the one deliberate exception.** It uses
`APP_ICON_MARK_SCALE_EXCEPTION` in `website/scripts/build-brand-assets.mjs`,
which is a smaller `0.66`. The dock shows the icon between 32 and 64px, and at
that size the dog's outline needs space around it to stay readable. Nothing
else changes: the badge, the site logo and the favicon all use the shared
`0.76`, and the inset is still calculated on both axes. A second exception
needs a reason as concrete as that one.

The word is always **Goodboy**: one word, capital G. Never `GoodBoy`, never
`goodboy` in running text, never an abbreviation. `GB` is not a short form of
anything here.

## Colour

The identity colour of the product is `--color-primary`. The website keeps its
own `--accent` token for the same role. Read the tokens, do not retype them.

The tile behind the mark is **black, never the primary colour**. It is the same
value on the site, in the favicon and in the app icon: `--brand-tile` in
`website/src/styles.css` and `--color-brand` in `apps/desktop/src/styles.css`.
The generator refuses to run when those two disagree.

**The app chrome never paints the tile.** A fixed black tile on the top bar
disappeared on the dark theme (1.09:1 against `bg-background`) and read as a
dark block on the light theme. Neither is the brand. So the top bar shows the
bare glyph in the theme foreground, and `--color-brand` stays only to keep the
generator honest against the site. Do not bring the tile back into the chrome,
and do not give it a border, a lighter dark-theme variant or a glow. On the
site, the favicon and the dock the tile stands alone and does its job.
`brand-mark-is-centered-in-its-tile.test.ts` checks both halves.

The background is white on the site and charcoal in the app, and both are
correct. An asset made for one does not automatically work on the other. So a
social image says which background it was built for.

## Provider and integration marks

When an asset shows what Goodboy works with, the logos come from the code, not
from a designer's memory. The agents come from `PROVIDER_IDS` in
`packages/types/src/provider-registry.ts`. The rest come from the integration
union in `packages/types/src/workspace.ts`. The glyphs themselves live in
`packages/ui/src/components/brandIcons.tsx`, and the colours in the
`--color-provider-*` tokens.

Two rules stop a row of logos from looking like a partner page:

- **Show a category completely or not at all.** Showing four of seven
  providers claims that those four are the ones that matter.
- **Label the rows.** With `Agents` and `Your work` as labels, a grid of logos
  reads like a sentence. Without labels, the same logos look like integrations
  we got permission to display.

An asset with such a row carries a date, because the lists change. When a new
provider is added, the asset is out of date until someone regenerates it.

## Social formats

The sizes below are what each platform really shows, not what its help page
suggests. Every one of these is generated, never cropped by hand.

| Surface                     | Size                     | Keep clear                                                                          |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| X avatar                    | 1024x1024                | The corners, because of the circle crop                                             |
| X header                    | 1500x500                 | Bottom left, where the avatar overlaps, and the top and bottom edges, cut on mobile |
| LinkedIn company cover      | 1128x191, rendered at 2x | Bottom left, under the company logo                                                 |
| LinkedIn profile background | 1584x396                 | The left third, under the profile photo                                             |
| og-image                    | 1200x630                 | Nothing, but crawlers only take the PNG, so the PNG is the only source              |

A banner shows up much smaller than it is made. 1500 px wide becomes about 600
on desktop and 440 on mobile. Anything under about 40 px in the source can't be
read where people actually see it. That is why the thin LinkedIn cover has no
logos at all.

## Rendering

Assets are rendered with **system Chrome headless**, from an HTML card that
uses the real tokens and the real mask. This project has no puppeteer,
imagemagick or rsvg, and none will be added for this.

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=1 \
  --window-size=WxH --screenshot=out.png file:///path/card.html
```

Chrome renders `oklch()` and CSS masks exactly, so the card uses the same
colour space the product ships in. Some surfaces compress images hard. For
those, render at `--force-device-scale-factor=2` and let the platform scale it
down. So far every LinkedIn cover needs this.

`website/scripts/build-brand-assets.mjs` owns every generated surface: the
five social formats above, plus `favicon` and `app-icon`. To rebuild one
surface and leave the rest alone, pass its slug:

```
node scripts/build-brand-assets.mjs app-icon
```

`favicon` writes the whole of `website/public/favicon.svg`, tile and glyph
together, so nobody edits any attribute in it by hand. `app-icon` renders a
1024px card and hands it to the Tauri CLI. The CLI writes the PNG set, the
`.icns` and the `.ico` into `apps/desktop/src-tauri/icons`. The CLI writes the
`.icns` chunks in a random order. So the script compares the chunk contents,
not the raw bytes, and leaves the file alone when only the order changed.
Never paste a binary into that directory by hand: rerun the surface.
