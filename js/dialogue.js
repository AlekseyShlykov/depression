// Dialogue engine: walks a scene graph (see twison.js), types one line at a time
// (character-by-character), highlights the speaking alien, and advances with a
// "Continue" control when more lines remain in the passage.

const CHAR_MS = 26; // base delay per character (typing)
const PAUSE_BEFORE_CHOICES_MS = 480; // pause after last line before buttons

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Like `sleep(ms)` but returns early when `shouldStop()` is true (poll ~20ms). */
async function sleepUntil(ms, shouldStop) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (shouldStop()) return;
    await sleep(Math.min(20, Math.max(1, end - Date.now())));
  }
}

function charDelay(ch) {
  if (!ch) return CHAR_MS;
  if (ch === " " || ch === "\n" || ch === "\t") return Math.min(14, CHAR_MS);
  if (/[.,!?…;:—\-–]/.test(ch)) return CHAR_MS + 55;
  return CHAR_MS;
}

export class DialogueEngine {
  constructor({
    linesEl,
    choicesEl,
    alienEls,
    onCommand,
    onStoryEnd,
    onPassageStart,
    getContinueLabel,
  }) {
    this.linesEl = linesEl;
    this.choicesEl = choicesEl;
    this.alienEls = alienEls;
    /** @type {(() => string) | null} */
    this.getContinueLabel = typeof getContinueLabel === "function" ? getContinueLabel : null;
    /** @type {((cmd: string) => void) | null} */
    this.onCommand = onCommand ?? null;
    /** @type {(() => void) | null} */
    this.onStoryEnd = onStoryEnd ?? null;
    /** @type {(() => void) | null} */
    this.onPassageStart = onPassageStart ?? null;
    this.scenes = null;
    this.currentPassage = null;
    this.history = [];
    this._renderToken = 0;
    /** @type {(() => void) | null} — set while a line is typing; completes the line early */
    this._typingSkip = null;
  }

  /** Completes the current typewriter line immediately (e.g. after a tap on the stage). */
  finishTypingLine() {
    this._typingSkip?.();
  }

  setScenes(scenes) {
    this.scenes = scenes;
    this.history = [];
    this.currentPassage = null;
    this._renderToken++;
  }

  start() {
    if (!this.scenes) return;
    this.history = [];
    this.renderPassage(this.scenes.start);
  }

  canGoBack() {
    return this.history.length > 0;
  }

  goBack() {
    if (!this.canGoBack()) return;
    const prev = this.history.pop();
    this.renderPassage(prev, { pushHistory: false });
  }

  renderPassage(name, { pushHistory = true } = {}) {
    if (!this.scenes) return;
    const passage = this.scenes.passages[name];
    if (!passage) {
      console.warn(`Passage not found: ${name}`);
      const startName = this.scenes.start;
      if (startName && name !== startName && this.scenes.passages[startName]) {
        this.renderPassage(startName, { pushHistory: false });
        return;
      }
      this.linesEl.innerHTML = "";
      this.choicesEl.innerHTML = "";
      this.onPassageStart?.();
      this._clearAlienStates();
      return;
    }

    if (pushHistory && this.currentPassage && this.currentPassage !== name) {
      this.history.push(this.currentPassage);
    }
    this.currentPassage = name;

    const token = ++this._renderToken;
    this._typingSkip = null;

    this.linesEl.innerHTML = "";
    this.choicesEl.innerHTML = "";
    this.onPassageStart?.();
    this._clearAlienStates();

    void this._playPassageSequence(passage, token);
  }

  async _playPassageSequence(passage, token) {
    const lines = passage.lines ?? [];
    if (lines.length === 0) {
      if (token !== this._renderToken) return;
      this._renderChoices(passage.choices ?? []);
      return;
    }

    const instant =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    let idx = 0;
    while (idx < lines.length && this._isCommandStep(lines[idx])) {
      if (token !== this._renderToken) return;
      this._runCommand(lines[idx].cmd);
      idx++;
    }

    while (idx < lines.length) {
      if (token !== this._renderToken) return;
      if (this._isCommandStep(lines[idx])) {
        this._runCommand(lines[idx].cmd);
        idx++;
        continue;
      }

      const step = lines[idx];
      if (!this._isSayStep(step)) {
        idx++;
        continue;
      }
      idx++;

      const line = this._normalizeSayStep(step);
      this._setSpeaker(line.speaker);

      this.linesEl.innerHTML = "";
      if (instant) {
        this._appendLineInstant(line);
      } else {
        await this._typeLine(line, token);
      }
      if (token !== this._renderToken) return;

      const hasMoreSay = this._hasMoreSayAhead(lines, idx);
      if (hasMoreSay) {
        await sleep(90);
        if (token !== this._renderToken) return;
        await this._waitContinue(token);
        if (token !== this._renderToken) return;
        while (idx < lines.length && this._isCommandStep(lines[idx])) {
          if (token !== this._renderToken) return;
          this._runCommand(lines[idx].cmd);
          idx++;
        }
      } else {
        while (idx < lines.length && this._isCommandStep(lines[idx])) {
          if (token !== this._renderToken) return;
          this._runCommand(lines[idx].cmd);
          idx++;
        }
        break;
      }
    }

    if (token !== this._renderToken) return;
    await sleep(PAUSE_BEFORE_CHOICES_MS);
    if (token !== this._renderToken) return;
    this._renderChoices(passage.choices ?? []);
  }

  _hasMoreSayAhead(lines, startIdx) {
    for (let i = startIdx; i < lines.length; i++) {
      if (this._isCommandStep(lines[i])) continue;
      return this._isSayStep(lines[i]);
    }
    return false;
  }

  async _waitContinue(token) {
    this.choicesEl.innerHTML = "";
    const label =
      this.getContinueLabel != null ? this.getContinueLabel() : "Continue";
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        btn.removeEventListener("click", onClick);
        this.choicesEl.innerHTML = "";
        resolve();
      };
      const onClick = () => finish();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = label;
      this.choicesEl.appendChild(btn);
      const poll = setInterval(() => {
        if (token !== this._renderToken) finish();
      }, 80);
      btn.addEventListener("click", onClick);
    });
  }

  _appendLineInstant(line) {
    const wrap = document.createElement("p");
    wrap.className = "dialogue-line";
    wrap.dataset.speaker = line.speaker;
    const textEl = document.createElement("span");
    textEl.className = "text";
    textEl.textContent = line.text;
    wrap.appendChild(textEl);
    this.linesEl.appendChild(wrap);
    requestAnimationFrame(() => {
      this.linesEl.scrollTop = this.linesEl.scrollHeight;
    });
  }

  async _typeLine(line, token) {
    const wrap = document.createElement("p");
    wrap.className = "dialogue-line";
    wrap.dataset.speaker = line.speaker;
    const textEl = document.createElement("span");
    textEl.className = "text";
    wrap.appendChild(textEl);
    this.linesEl.appendChild(wrap);

    const full = line.text ?? "";
    const len = full.length;
    let skipRequested = false;
    this._typingSkip = () => {
      skipRequested = true;
    };

    for (let i = 1; i <= len; i++) {
      if (token !== this._renderToken) {
        this._typingSkip = null;
        return;
      }
      if (skipRequested) {
        textEl.textContent = full;
        requestAnimationFrame(() => {
          if (token === this._renderToken) {
            this.linesEl.scrollTop = this.linesEl.scrollHeight;
          }
        });
        this._typingSkip = null;
        return;
      }
      textEl.textContent = full.slice(0, i);
      requestAnimationFrame(() => {
        if (token === this._renderToken) {
          this.linesEl.scrollTop = this.linesEl.scrollHeight;
        }
      });
      if (i < len) {
        const ch = full[i - 1];
        await sleepUntil(charDelay(ch), () => skipRequested);
      }
    }
    this._typingSkip = null;
  }

  _isCommandStep(step) {
    if (!step || typeof step !== "object") return false;
    if (step.type === "cmd") return true;
    return false;
  }

  _isSayStep(step) {
    if (!step || typeof step !== "object") return false;
    if (step.type === "say") return true;
    if (step.type === "cmd") return false;
    return "speaker" in step && "text" in step;
  }

  /** Legacy passages: { speaker, text } without `type`. */
  _normalizeSayStep(step) {
    if (step.type === "say") return { speaker: step.speaker, text: step.text };
    return { speaker: step.speaker, text: step.text };
  }

  _runCommand(cmd) {
    if (typeof cmd !== "string" || !cmd.trim()) return;
    try {
      this.onCommand?.(cmd);
    } catch (e) {
      console.warn("[dialogue cmd]", e);
    }
  }

  _renderChoices(choices) {
    this.choicesEl.innerHTML = "";
    if (!choices || choices.length === 0) {
      this.onStoryEnd?.();
      return;
    }
    choices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = choice.text;
      btn.style.animationDelay = `${i * 60}ms`;
      btn.addEventListener("click", () => {
        this.renderPassage(choice.next);
      });
      this.choicesEl.appendChild(btn);
    });
  }

  _setSpeaker(speaker) {
    const a1 = this.alienEls.alien1;
    const a2 = this.alienEls.alien2;
    if (!a1 || !a2) return;
    a1.classList.remove("is-speaking", "is-dimmed");
    a2.classList.remove("is-speaking", "is-dimmed");
    if (speaker === "alien1") {
      a1.classList.add("is-speaking");
      a2.classList.add("is-dimmed");
    } else if (speaker === "alien2") {
      a2.classList.add("is-speaking");
      a1.classList.add("is-dimmed");
    }
  }

  _clearAlienStates() {
    const a1 = this.alienEls.alien1;
    const a2 = this.alienEls.alien2;
    if (a1) a1.classList.remove("is-speaking", "is-dimmed");
    if (a2) a2.classList.remove("is-speaking", "is-dimmed");
  }
}
