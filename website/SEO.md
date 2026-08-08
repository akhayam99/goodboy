# SEO . Goodboy website

Questo file descrive tutto ciò che serve a un agente (o a te) per mantenere, aggiornare ed estendere la SEO del sito senza doverla riscoprire da zero.

---

## Stato attuale

| Layer                       | File                  | Status     |
| --------------------------- | --------------------- | ---------- |
| Robots                      | `public/robots.txt`   | ✓ presente |
| Sitemap                     | `public/sitemap.xml`  | ✓ presente |
| OG image (SVG placeholder)  | `public/og-image.svg` | ✓ presente |
| OG image (PNG produzione)   | `public/og-image.png` | ✓ generata |
| Meta tags completi          | `index.html`          | ✓ completo |
| JSON-LD SoftwareApplication | `index.html`          | ✓ presente |
| Twitter/X card              | `index.html`          | ✓ presente |
| Canonical                   | `index.html`          | ✓ presente |

---

## Dominio di produzione

Dominio reale: `https://goodboy-ai.dev/`

Se il dominio cambia di nuovo, cerca e sostituisci `goodboy-ai.dev` in:

- `public/robots.txt` (Sitemap:)
- `public/sitemap.xml` (<loc>)
- `index.html` (canonical, og:url, og:image, twitter:image)

```bash
# find & replace rapido
grep -rn "goodboy-ai.dev" website/public/ website/index.html
```

---

## OG image

### Come generare il PNG

`og:image` punta a `https://goodboy-ai.dev/og-image.png`, che è generato:

```bash
node website/scripts/build-og.mjs
```

Lo script compone la card in HTML e la fotografa con il Chrome di sistema in
headless, senza puppeteer. Legge la mascotte da `src/assets/mascot.png` e i
loghi dei provider da `src/components/BrandIcons.tsx`, quindi i marchi restano
allineati a quelli della landing senza copiarli a mano. Il titolo e il
sottotitolo stanno dentro lo script: se cambia l'headline della hero, vanno
cambiati lì e il PNG va rigenerato.

`public/og-image.svg` è il vecchio placeholder scuro, non più usato da nessuna
parte.

### Quando aggiornare l'OG image

- Cambio tagline
- Nuovo logo
- Nuovo major version (es. v0.1.0)
- Cambio palette

---

## Meta tags . posizione e logica

Tutti i meta risiedono in `website/index.html` (app SPA . unico HTML). Non ci sono route secondarie da gestire.

### Gerarchia consigliata (già presente)

```
1. <title>           . testo puro, max 60 char
2. meta description  . 120–160 char, include differenziator principale
3. og:title/desc     . può essere leggermente più lungo del <title>
4. twitter:*         . stessa copia di OG (summary_large_image)
5. canonical         . https://goodboy-ai.dev/ sempre con trailing slash
6. JSON-LD           . SoftwareApplication schema
```

### Regole di copy SEO

- keyword primaria nella prima frase: "AI workspace orchestrator"
- keyword secondarie: "local-first", "multi-agent", "Claude Cursor Codex Antigravity", "developer tools"
- niente keyword stuffing: le parole chiave vanno nei testi del sito, non solo nei meta
- `<title>` format: `[Product] . [tagline corta]` (es. "Goodboy . AI workspace orchestrator")

---

## JSON-LD . SoftwareApplication

Definito inline in `index.html`. Campi da tenere aggiornati:

| Campo             | Dove aggiornare                                      |
| ----------------- | ---------------------------------------------------- |
| `softwareVersion` | Ad ogni release (v0.0.7 → v0.0.8 → v0.1.0)           |
| `featureList`     | Quando si aggiungono/rimuovono features dal prodotto |
| `offers.price`    | Quando arriva il pricing                             |
| `operatingSystem` | Se si aggiunge mobile/web                            |

Schema reference: [schema.org/SoftwareApplication](https://schema.org/SoftwareApplication)

Validare con: [Google Rich Results Test](https://search.google.com/test/rich-results) o [Schema.org Validator](https://validator.schema.org/).

---

## Sitemap

`public/sitemap.xml` . SPA con un solo URL, quindi una sola `<url>`.

### Quando aggiornare

- Cambio URL del sito
- Aggiunta di pagine separate (es. `/docs`, `/blog`)
- Cambio significativo al contenuto del sito → aggiorna `<lastmod>`

### Se diventa multi-page

Aggiungi ogni URL come `<url>` separato. `<priority>` consigliata:

- `/` → 1.0
- `/docs` → 0.8
- `/blog/[post]` → 0.6

---

## Robots.txt

`public/robots.txt` . attuale configurazione: tutto crawlabile.

Modificare solo se:

- Si aggiunge un admin panel o route privata → `Disallow: /admin`
- Si aggiungono route parametriche di debug → `Disallow: /?*`

Non bloccare mai `/` o le risorse statiche (CSS/JS/immagini) . penalizza il rendering Google.

---

## Checklist pre-deploy

- [x] Sostituire `goodboy.dev` con il dominio reale (`goodboy-ai.dev`)
- [x] Generare `public/og-image.png` (1200×630 px, < 8 MB)
- [ ] Verificare JSON-LD con Google Rich Results Test
- [ ] Aggiornare `<lastmod>` in `sitemap.xml` con la data di deploy
- [ ] Aggiornare `twitter:site` in `index.html` con l'handle Twitter reale
- [ ] Submit sitemap su Google Search Console: `https://search.google.com/search-console`
- [ ] Submit sitemap su Bing Webmaster Tools (opzionale ma gratuito)
- [ ] Verificare che `og:image` risponda 200 con content-type corretto

---

## Checklist post-deploy

- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) sull'URL di produzione
- [ ] [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) . verifica unfurl OG
- [ ] [Twitter Card Validator](https://cards-dev.twitter.com/validator) . verifica card
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) . target LCP < 2.5s, CLS < 0.1
- [ ] Controlla che `robots.txt` risponda su `https://[domain]/robots.txt`
- [ ] Controlla che `sitemap.xml` risponda su `https://[domain]/sitemap.xml`

---

## Performance SEO

Il sito già ottimizzato per Core Web Vitals:

- bundle JS: 248kB raw / 73kB gzip (Vite tree-shaking)
- CSS: 31kB raw / 7kB gzip
- no layout shift: altezze definite, niente skeleton dinamici
- font: system font stack (nessuna Google Fonts request)
- immagini: solo SVG inline . nessun LCP da bitmap

Se si aggiungono immagini reali (screenshots dell'app):

- formato WebP con fallback JPG
- attributi `width` e `height` sempre presenti
- `loading="lazy"` per immagini sotto the fold
- `loading="eager"` + `fetchpriority="high"` per l'hero image

---

## Internazionalizzazione (non attiva)

Il sito è English-only. Se si aggiunge l'italiano:

- aggiungere `<link rel="alternate" hreflang="it" href="https://goodboy-ai.dev/it/" />`
- aggiungere `<link rel="alternate" hreflang="en" href="https://goodboy-ai.dev/" />`
- aggiungere `<link rel="alternate" hreflang="x-default" href="https://goodboy-ai.dev/" />`

---

## File map

```
website/
├── index.html              ← tutti i meta tags, JSON-LD
├── public/
│   ├── robots.txt          ← crawl policy + sitemap pointer
│   ├── sitemap.xml         ← URL index
│   ├── favicon.svg         ← browser tab icon
│   ├── og-image.svg        ← og image placeholder (dev)
│   └── og-image.png        ← og image produzione (node scripts/build-og.mjs)
└── SEO.md                  ← questo file
```
