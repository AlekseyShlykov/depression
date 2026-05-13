// App bootstrap: load locale + dialogue, wire up screen switching,
// language toggle, and the persistent footer.

import {
  loadLang,
  t,
  getCurrentLang,
  getStoredLang,
  otherLang,
} from "./i18n.js";
import { loadScenes } from "./twison.js";
import { DialogueEngine } from "./dialogue.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  titleScreen: $("#title-screen"),
  gameScreen: $("#game-screen"),
  titleText: $("#title-text"),
  startBtn: $("#start-btn"),
  langToggleTitle: $("#lang-toggle-title"),
  langToggleGame: $("#lang-toggle-game"),
  backBtn: $("#back-btn"),
  alien1: $("#alien-1"),
  alien2: $("#alien-2"),
  alien1Label: $("#alien-1-label"),
  alien2Label: $("#alien-2-label"),
  lines: $("#dialogue-lines"),
  choices: $("#choices"),
  endEmailPanel: $("#end-email-panel"),
  endEmailLead: $("#end-email-lead"),
  endEmailForm: $("#end-email-form"),
  endEmailLabelText: $("#end-email-label-text"),
  endEmailInput: $("#end-email-input"),
  endEmailSubmit: $("#end-email-submit"),
  endEmailThanks: $("#end-email-thanks"),
  endEmailError: $("#end-email-error"),
  footerCredit: $("#footer-credit"),
  footerLink: $("#footer-link"),
  footerMusicWrap: $("#footer-music-wrap"),
  musicBtn: $("#music-btn"),
  titleBg: document.querySelector('[data-bg="title"]'),
  gameBg: document.querySelector('[data-bg="game"]'),
  stage: document.querySelector("#game-screen .stage"),
};

const musicAudio = new Audio("assets/backingmusic.mp3");
musicAudio.loop = true;
musicAudio.preload = "none";

/** Twine `//…` system commands (see twison.js). Extend as needed. */
function runStoryCommand(cmd) {
  const n = cmd
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFKC");

  const musicOn =
    (n.includes("включи") && n.includes("музык")) ||
    (n.includes("запусти") && n.includes("музык")) ||
    n.includes("play music") ||
    n.includes("start music") ||
    n.includes("turn on music") ||
    n === "music on";

  const musicOff =
    ((n.includes("останов") ||
      n.includes("выключи") ||
      n.includes("пауза")) &&
      n.includes("музык")) ||
    n.includes("pause music") ||
    n.includes("stop music") ||
    n === "music off";

  if (musicOn) {
    musicAudio
      .play()
      .then(() => {
        revealMusicFooter();
        syncMusicButton();
      })
      .catch(() => {
        syncMusicButton();
      });
    return;
  }
  if (musicOff) {
    musicAudio.pause();
    syncMusicButton();
    return;
  }

  console.warn("[story command] unsupported:", cmd);
}

/** Footer music: hidden until a passage runs a “music on” // command successfully. */
function hideMusicFooter() {
  const wrap = els.footerMusicWrap;
  if (!wrap) return;
  wrap.hidden = true;
}

function revealMusicFooter() {
  const wrap = els.footerMusicWrap;
  if (!wrap || wrap.hidden === false) return;
  wrap.hidden = false;
  syncMusicButton();
}

/** Formspree: only the `email` field is submitted (no message body). */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mjgldbwb";

/** Horizontal pan of the game background (phone portrait only). 0–100 (%). */
let stageBgPanPct = 50;

/** @type {{ pointerId: number; startX: number; startPct: number } | null} */
let stageBgPanDrag = null;

function stagePanMediaQuery() {
  return window.matchMedia("(max-width: 640px) and (orientation: portrait)");
}

function applyStageBgPan() {
  if (!els.gameBg) return;
  if (!stagePanMediaQuery().matches) {
    els.gameBg.style.backgroundPosition = "";
    return;
  }
  els.gameBg.style.backgroundPosition = `${stageBgPanPct}% bottom`;
}

function resetStageBgPan() {
  stageBgPanPct = 50;
  applyStageBgPan();
}

function resetEndEmailUi() {
  const p = els.endEmailPanel;
  const f = els.endEmailForm;
  const th = els.endEmailThanks;
  const er = els.endEmailError;
  const sub = els.endEmailSubmit;
  if (!p) return;
  // Belt-and-suspenders: `display: none` makes hiding immune to author CSS
  // overriding the [hidden] attribute.
  p.hidden = true;
  p.style.display = "none";
  if (f) {
    f.hidden = false;
    f.style.display = "";
    f.reset();
  }
  if (th) {
    th.hidden = true;
    th.style.display = "none";
  }
  if (er) {
    er.hidden = true;
    er.style.display = "none";
  }
  if (sub) sub.disabled = false;
}

function hideEndEmailForm() {
  resetEndEmailUi();
}

function showEndEmailForm() {
  const p = els.endEmailPanel;
  if (!p) return;
  p.hidden = false;
  p.style.display = "";
  if (els.endEmailForm) {
    els.endEmailForm.hidden = false;
    els.endEmailForm.style.display = "";
  }
  if (els.endEmailThanks) {
    els.endEmailThanks.hidden = true;
    els.endEmailThanks.style.display = "none";
  }
  if (els.endEmailError) {
    els.endEmailError.hidden = true;
    els.endEmailError.style.display = "none";
  }
  if (els.endEmailSubmit) els.endEmailSubmit.disabled = false;
}

const engine = new DialogueEngine({
  linesEl: els.lines,
  choicesEl: els.choices,
  alienEls: { alien1: els.alien1, alien2: els.alien2 },
  onCommand: runStoryCommand,
  onStoryEnd: () => showEndEmailForm(),
  onPassageStart: () => hideEndEmailForm(),
  getContinueLabel: () => t("continue", "Continue"),
});

let scenes = null;

function bgForLang(lang) {
  return lang === "ru" ? "assets/rusheep.png" : "assets/ensheep.png";
}

function applyStaticStrings() {
  const lang = getCurrentLang();
  const storyTitle =
    (scenes && typeof scenes.gameTitle === "string" && scenes.gameTitle.trim()) ||
    t("title", "The Earthling");
  document.title = storyTitle;
  els.titleText.textContent = storyTitle;
  els.startBtn.textContent = t("start", "Start Game");
  els.backBtn.textContent = t("back", "Back");

  const switchLabel = t("switchLanguage", otherLang().toUpperCase());
  els.langToggleTitle.textContent = switchLabel;
  els.langToggleGame.textContent = switchLabel;

  els.footerCredit.textContent = t("footer.credit", "Created by Alex Shlykov");
  els.footerLink.textContent = t("footer.linkLabel", "buildtounderstand.dev");
  els.footerLink.href = t("footer.linkUrl", "https://buildtounderstand.dev/");

  const url = bgForLang(lang);
  els.titleBg.style.backgroundImage = `url("${url}")`;
  els.gameBg.style.backgroundImage = `url("${url}")`;
  resetStageBgPan();

  if (els.alien1Label)
    els.alien1Label.textContent = t("speakers.alien1", "Alien 1");
  if (els.alien2Label)
    els.alien2Label.textContent = t("speakers.alien2", "Alien 2");

  if (els.endEmailLead)
    els.endEmailLead.textContent = t(
      "endForm.lead",
      "The story ends here. If you want a note when there is more, leave your email."
    );
  if (els.endEmailLabelText)
    els.endEmailLabelText.textContent = t("endForm.label", "Email");
  if (els.endEmailSubmit)
    els.endEmailSubmit.textContent = t("endForm.submit", "Send");

  syncMusicButton();
}

function syncMusicButton() {
  if (!els.musicBtn) return;
  if (els.footerMusicWrap?.hidden) return;
  const playing = !musicAudio.paused;
  els.musicBtn.textContent = playing
    ? t("footer.musicPause", "Pause")
    : t("footer.musicPlay", "Music");
  els.musicBtn.setAttribute("aria-pressed", playing ? "true" : "false");
  els.musicBtn.setAttribute(
    "aria-label",
    playing
      ? t("footer.musicAriaPause", "Pause background music")
      : t("footer.musicAriaPlay", "Play background music")
  );
}

async function setLanguage(lang) {
  await loadLang(lang);
  scenes = await loadScenes(lang);
  engine.setScenes(scenes);
  applyStaticStrings();

  // If we're currently on the game screen, re-render the current passage
  // in the new language. Otherwise just refresh static strings.
  if (els.gameScreen.classList.contains("is-active")) {
    const here = engine.currentPassage ?? scenes.start;
    const target = scenes.passages[here] ? here : scenes.start;
    engine.renderPassage(target, { pushHistory: false });
  }
}

function showTitleScreen() {
  hideEndEmailForm();
  hideMusicFooter();
  els.gameScreen.classList.remove("is-active");
  els.titleScreen.classList.add("is-active");
}

function showGameScreen() {
  hideMusicFooter();
  hideEndEmailForm();
  els.titleScreen.classList.remove("is-active");
  els.gameScreen.classList.add("is-active");
  resetStageBgPan();
  engine.start();
}

function wireEvents() {
  els.startBtn.addEventListener("click", showGameScreen);

  if (els.gameScreen) {
    els.gameScreen.addEventListener(
      "pointerdown",
      (e) => {
        if (!els.gameScreen.classList.contains("is-active")) return;
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (
          t.closest(
            "button, a[href], input, textarea, select, label, [role='button']"
          )
        ) {
          return;
        }
        engine.finishTypingLine();
      },
      true
    );
  }

  els.backBtn.addEventListener("click", () => {
    if (engine.canGoBack()) {
      engine.goBack();
    } else {
      showTitleScreen();
    }
  });

  const onToggle = async () => {
    const next = otherLang();
    try {
      await setLanguage(next);
    } catch (e) {
      console.error(e);
    }
  };
  els.langToggleTitle.addEventListener("click", onToggle);
  els.langToggleGame.addEventListener("click", onToggle);

  if (els.musicBtn) {
    els.musicBtn.addEventListener("click", async () => {
      try {
        if (musicAudio.paused) {
          await musicAudio.play();
        } else {
          musicAudio.pause();
        }
      } catch (e) {
        console.error(e);
      }
      syncMusicButton();
    });
    musicAudio.addEventListener("play", syncMusicButton);
    musicAudio.addEventListener("pause", syncMusicButton);
  }

  if (els.endEmailForm) {
    els.endEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = els.endEmailInput?.value?.trim() ?? "";
      if (!raw || !els.endEmailSubmit) return;

      if (els.endEmailError) els.endEmailError.hidden = true;
      els.endEmailSubmit.disabled = true;

      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: raw,
            _subject: t("endForm.emailSubject", "The Earthling — mailing list"),
          }),
        });
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          /* non-JSON body */
        }
        if (!res.ok) {
          const msg =
            (data && typeof data.error === "string" && data.error) ||
            (Array.isArray(data?.errors) && data.errors[0]?.message) ||
            `HTTP ${res.status}`;
          throw new Error(msg);
        }
        if (els.endEmailForm) {
          els.endEmailForm.hidden = true;
          els.endEmailForm.style.display = "none";
        }
        if (els.endEmailThanks) {
          els.endEmailThanks.textContent = t(
            "endForm.thanks",
            "Thank you — we will be in touch."
          );
          els.endEmailThanks.hidden = false;
          els.endEmailThanks.style.display = "";
        }
      } catch (err) {
        console.warn("[end email form]", err);
        if (els.endEmailError) {
          els.endEmailError.textContent = t(
            "endForm.error",
            "Could not send. Check your connection and try again."
          );
          els.endEmailError.hidden = false;
          els.endEmailError.style.display = "";
        }
        els.endEmailSubmit.disabled = false;
      }
    });
  }

  wireStageBackgroundPan();
}

function wireStageBackgroundPan() {
  const stage = els.stage;
  const bg = els.gameBg;
  if (!stage || !bg) return;

  const mq = stagePanMediaQuery();
  mq.addEventListener("change", () => {
    stageBgPanDrag = null;
    if (!mq.matches) {
      stageBgPanPct = 50;
      bg.style.backgroundPosition = "";
    } else {
      applyStageBgPan();
    }
  });

  stage.addEventListener("pointerdown", (e) => {
    if (!mq.matches) return;
    if (!els.gameScreen?.classList.contains("is-active")) return;
    if (!e.isPrimary) return;
    if (e.button !== 0) return;
    stageBgPanDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startPct: stageBgPanPct,
    };
    try {
      stage.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });

  stage.addEventListener("pointermove", (e) => {
    if (!stageBgPanDrag || e.pointerId !== stageBgPanDrag.pointerId) return;
    if (!e.isPrimary) return;
    if (!mq.matches) return;
    const w = stage.getBoundingClientRect().width || 1;
    const dx = e.clientX - stageBgPanDrag.startX;
    const deltaPct = (-dx / w) * 115;
    const raw = stageBgPanDrag.startPct + deltaPct;
    stageBgPanPct = Math.max(0, Math.min(100, raw));
    applyStageBgPan();
  });

  const endPan = (e) => {
    if (!stageBgPanDrag || e.pointerId !== stageBgPanDrag.pointerId) return;
    try {
      stage.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    stageBgPanDrag = null;
  };
  stage.addEventListener("pointerup", endPan);
  stage.addEventListener("pointercancel", endPan);
}

async function boot() {
  const initial = getStoredLang() ?? "en";
  try {
    await setLanguage(initial);
  } catch (e) {
    console.error("Failed to boot:", e);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;background:#000;padding:24px;text-align:center;font-family:system-ui">
         Could not load game data.<br/><small>${String(e.message ?? e)}</small>
       </div>`
    );
    return;
  }
  wireEvents();
}

boot();
