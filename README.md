# The Earthling — prototype

A tiny browser game prototype: a title screen, then a dialogue scene with two
animated aliens reacting as they speak. Story content is authored in
[Twine](https://twinery.org/) and exported as JSON; all UI strings live in
per-language locale files.

The whole game is plain HTML / CSS / ES-modules, so it deploys to GitHub Pages
as-is with no build step.

## Run locally

ES modules + `fetch()` require an HTTP origin (they will not work from a raw
`file://` path). Any tiny static server works, for example:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or

```bash
npx serve .
```

## Project layout

```
.
├── index.html              # entry point
├── style.css               # all styles
├── js/
│   ├── main.js             # boot, screen switching, language toggle
│   ├── i18n.js             # locale loader + t(key)
│   ├── twison.js           # Twine to JSON + Twison → scene graph
│   └── dialogue.js         # dialogue engine + alien speaking animation
├── locales/
│   ├── en.json             # UI strings (English)
│   └── ru.json             # UI strings (Russian)
├── dialogues/
│   ├── en.json             # Story export (Twine to JSON) — English
│   └── ru.json             # Story export (Twine to JSON) — Russian
├── assets/
│   ├── ensheep.png         # English-version background
│   ├── rusheep.png         # Russian-version background
│   ├── alien1.png          # left-side alien
│   └── alien2.png          # right-side alien
└── .nojekyll               # disables Jekyll on GitHub Pages
```

## Authoring dialogue in Twine

The game accepts **two** JSON shapes:

### A. “Twine to JSON” (recommended — your exporter)

If the file has `"schemaName": "Twine to JSON"` (or each passage has
`cleanText` and links use `passageName` / `linkText`), the loader uses:

* **`cleanText`** for spoken lines (Twine link lines are already stripped).
  If `cleanText` is missing, standalone `[[...]]` lines are removed from
  `text`.
* **`links[]`**: `linkText` → button label, `passageName` → target passage
  `name`.

The **first passage** in the `passages` array is the start of the story.

### B. Twison (legacy)

[Twison](https://github.com/lazerwalker/twison) exports with `startnode`,
`pid`, and `links` shaped as `{ name, link }` still work unchanged.

### Passage text conventions

Write **one spoken line per line**. Speaker prefixes (any casing):

```
Alien1: Look, he's waking up!
Alien2: Easy, easy... Welcome, Earthling!
```

You may also use `alien1:` / `alien2:` in lowercase.

* `Alien1` / `Alien2` drive the “who is speaking” highlight on the portraits
  (**the typing line’s** speaker is enlarged for the whole time that line is
  printing).
* **Typewriter:** each line appears **character by character** (slightly
  longer pauses after punctuation). With **`prefers-reduced-motion: reduce`**
  the full line appears at once instead.
* **In the dialogue box, only the line after the colon is shown.** Who is
  speaking is shown only by the **alien highlight** (enlarged portrait) while
  that line types.
* Lines with no `Speaker:` prefix become **narrator** lines.
* **System commands** — a whole line starting with `//` and non-empty text
  after it (e.g. `//включи музыку`) is **not** shown in the dialogue. It runs
  a handler in `js/main.js` (`runStoryCommand`). A line that is only `//` or
  spaces after `//` is ignored. Supported commands today include turning
  **background music** on/off (Russian and English phrasing — see
  `runStoryCommand` for the exact patterns). Unknown commands log a warning
  and are skipped.
* Standalone `[[...]]` lines in raw `text` are ignored when `cleanText` or
  structured `links` are present.

* **Simultaneous speech** (both aliens “at once”) cannot be expressed as two
  lines in a single passage in a readable way: split into **several passages**
  linked one after another so each beat has one speaker; the engine always
  enlarges only the alien who is typing the current line.

To add another named speaker later, use a new `Something:` prefix in the
story JSON and extend the dialogue engine / styles if you need a distinct
highlight or layout for that id.

## Switching the default language

The first load uses English. Players can toggle to Russian using the button on
either screen, and the choice is remembered in `localStorage`. To change the
default, edit the `initial = getStoredLang() ?? "en"` line in `js/main.js`.

## Deploying to GitHub Pages

1. Create a new GitHub repository, push this project to it.
2. In the repo settings → *Pages* → *Build and deployment*:
   * Source: **Deploy from a branch**
   * Branch: **`main`** (or `master`) → folder **`/ (root)`** → *Save*.
3. Wait ~30s for the first deploy, then open
   `https://<your-user>.github.io/<repo-name>/`.

The `.nojekyll` file is included so GitHub Pages will not try to process the
project with Jekyll and skip dot-prefixed files.

## Credits

Created by Alex Shlykov — <https://buildtounderstand.dev/>
