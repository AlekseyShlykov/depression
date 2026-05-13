// Story JSON → internal scene graph for dialogue.js.
//
// Supports:
// 1) Twison (Twine 2 + Twison story format): startnode, pid, links.name/link
// 2) "Twine to JSON" (schemaName "Twine to JSON"): passage.id, cleanText,
//    links.linkText / links.passageName — as exported by your Twine tool.
//    Optional root `gameTitle` — shown on the title screen / document.title
//    (stable display name; Twine `name` may change each export).
//
// Authoring lines (both formats):
//   * One spoken line per line.
//   * "Alien1: …" / "Alien2: …" (any casing, optional space) → speakers alien1 / alien2.
//   * "alien1: …" lowercase still works.
//   * Lines without a speaker prefix → narrator.
//   * Lines starting with "//" + text → system command (not shown), e.g.
//     `//включи музыку` — see `runStoryCommand` in main.js for supported verbs.
//   * A line that is only `//` or whitespace after slashes → ignored (empty).
//   * In one `say` block, two or more paragraphs separated by a blank line
//     (`\\n\\n` in the source) become separate on-screen lines (see
//     `splitMultiParagraphSaySteps` in twison.js).
//   * Standalone [[…]] link lines → dropped when choices come from passage.links.

function normalizeSpeakerId(raw) {
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  if (s === "alien1") return "alien1";
  if (s === "alien2") return "alien2";
  return s;
}

function splitMultiParagraphSaySteps(steps) {
  const out = [];
  for (const step of steps) {
    if (!step || step.type !== "say") {
      out.push(step);
      continue;
    }
    const text = String(step.text ?? "");
    const chunks = text
      .split(/\n\s*\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (chunks.length <= 1) {
      out.push(step);
      continue;
    }
    for (const chunk of chunks) {
      out.push({ type: "say", speaker: step.speaker, text: chunk });
    }
  }
  return out;
}

function parsePassageText(rawText) {
  if (!rawText) return [];
  const text = String(rawText).replace(/\r\n/g, "\n");
  const out = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // System command: //… (not shown in dialogue). Bare "//" is skipped.
    if (line.startsWith("//")) {
      const payload = line.slice(2).trim();
      if (payload) out.push({ type: "cmd", cmd: payload });
      continue;
    }

    if (/^\[\[.*\]\]$/.test(line)) continue;

    // Alien1: / Alien 2: / alien1:
    let m = line.match(/^Alien\s*1\s*:\s*(.+)$/i);
    if (m) {
      out.push({ type: "say", speaker: "alien1", text: m[1].trim() });
      continue;
    }
    m = line.match(/^Alien\s*2\s*:\s*(.+)$/i);
    if (m) {
      out.push({ type: "say", speaker: "alien2", text: m[1].trim() });
      continue;
    }

    m = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.+)$/);
    if (m) {
      const speaker = normalizeSpeakerId(m[1]);
      out.push({ type: "say", speaker, text: m[2].trim() });
    } else {
      out.push({ type: "say", speaker: "narrator", text: line });
    }
  }
  return out;
}

function stripStandaloneLinkLines(rawText) {
  if (!rawText) return "";
  return String(rawText)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((ln) => !/^\s*\[\[.*\]\]\s*$/.test(ln.trim()))
    .join("\n");
}

function passageBodyForTwineToJson(p) {
  if (p.cleanText != null && String(p.cleanText).trim() !== "") {
    return String(p.cleanText);
  }
  return stripStandaloneLinkLines(p.text ?? "");
}

function isTwineToJsonExport(data) {
  if (!data || !Array.isArray(data.passages)) return false;
  if (data.schemaName === "Twine to JSON") return true;
  const l0 = data.passages[0]?.links?.[0];
  if (l0 && typeof l0 === "object" && "passageName" in l0) return true;
  if (data.passages[0] && "cleanText" in data.passages[0]) return true;
  return false;
}

export function twineToJsonToScenes(data) {
  const passages = {};
  for (const p of data.passages) {
    if (!p?.name) continue;
    const body = passageBodyForTwineToJson(p);
    const lines = splitMultiParagraphSaySteps(parsePassageText(body));
    const choices = Array.isArray(p.links)
      ? p.links
          .map((link) => {
            if (!link) return null;
            const next = link.passageName ?? link.target ?? link.link;
            const text = link.linkText ?? link.name ?? next;
            if (!next) return null;
            return { text, next };
          })
          .filter(Boolean)
      : [];
    passages[p.name] = { lines, choices };
  }
  const firstName = data.passages[0]?.name;
  const startName =
    passages.Start != null
      ? "Start"
      : firstName && passages[firstName]
        ? firstName
        : null;
  if (!startName || !passages[startName]) {
    throw new Error('Invalid "Twine to JSON": missing passages or empty story.');
  }
  const gameTitle =
    typeof data.gameTitle === "string" && data.gameTitle.trim()
      ? data.gameTitle.trim()
      : null;
  return { start: startName, passages, gameTitle };
}

export function twisonToScenes(twisonJson) {
  if (!twisonJson || !Array.isArray(twisonJson.passages)) {
    throw new Error("Invalid Twison JSON: missing passages array.");
  }

  const byPid = new Map();
  for (const p of twisonJson.passages) {
    if (p && p.pid != null) byPid.set(String(p.pid), p);
  }

  const passages = {};
  let startName = null;

  for (const p of twisonJson.passages) {
    if (!p || !p.name) continue;
    const lines = splitMultiParagraphSaySteps(parsePassageText(p.text));
    const choices = Array.isArray(p.links)
      ? p.links
          .map((link) => {
            if (!link) return null;
            let target = link.link;
            if (!target && link.pid != null && byPid.has(String(link.pid))) {
              target = byPid.get(String(link.pid)).name;
            }
            if (!target) return null;
            return {
              text: link.name ?? target,
              next: target,
            };
          })
          .filter(Boolean)
      : [];
    passages[p.name] = { lines, choices };
  }

  if (twisonJson.startnode != null) {
    const startPassage = byPid.get(String(twisonJson.startnode));
    if (startPassage) startName = startPassage.name;
  }
  if (!startName) {
    if (passages.Start) startName = "Start";
    else startName = twisonJson.passages[0]?.name ?? null;
  }
  if (!startName) {
    throw new Error("Invalid Twison JSON: cannot determine start passage.");
  }

  const gameTitle =
    typeof twisonJson.gameTitle === "string" && twisonJson.gameTitle.trim()
      ? twisonJson.gameTitle.trim()
      : null;

  return { start: startName, passages, gameTitle };
}

export function storyJsonToScenes(data) {
  if (isTwineToJsonExport(data)) return twineToJsonToScenes(data);
  return twisonToScenes(data);
}

export async function loadScenes(lang) {
  const res = await fetch(`dialogues/${lang}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load dialogue for ${lang}`);
  const raw = await res.json();
  return storyJsonToScenes(raw);
}
