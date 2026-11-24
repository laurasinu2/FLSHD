import { THEMES, WORDS, byTheme, themeById, wordById } from "./data.js";
import {
  seedWords,
  defaultProgress,
  getAllProgress,
  getAllImages,
  saveProgress,
  saveWordImage,
  getMeta,
  setMeta,
  configureLocalAccount,
  importGuestData
} from "./db.js";
import { cloudConfigured, cloudReady, initializeCloud, signIn, signUp, signOut, synchronize, queueCloudSync } from "./cloud.js";
import {
  dateOnly,
  errorsInLastDays,
  scheduleFailure,
  scheduleNewlyLearned,
  scheduleReviewSuccess,
  buildReviewQueue,
  reviewUrgency
} from "./srs.js";

const root = document.querySelector("#app");
const navButtons = [...document.querySelectorAll(".bottom-nav [data-tab]")];
const reviewBadge = document.querySelector("#reviewBadge");

const state = {
  tab: "learn",
  screen: "home",
  topicId: null,
  progress: new Map(),
  images: new Map(),
  storageAvailable: true,
  session: null,
  checkpoints: {},
  account: null,
  cloudStatus: "local",
  cloudError: "",
  accountBusy: false,
  booting: true
};

const BLOCK_SIZE = 6;
const checkpointCount = Math.ceil(THEMES.length / BLOCK_SIZE);
const CHECKPOINTS = Array.from({ length: checkpointCount }, (_, index) => {
  const number = index + 1;
  const isFinal = number === checkpointCount;
  return {
    id: `checkpoint-${number}`,
    after: Math.min(number * BLOCK_SIZE, THEMES.length),
    title: isFinal ? "Prueba final A1" : `Prueba de nivel ${number}`,
    icon: isFinal ? "🎓" : "🏁",
    questionCount: 12
  };
});

const PHASES = ["flashcard", "choice", "typing"];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function progressFor(wordId) {
  return state.progress.get(wordId) || defaultProgress(wordId);
}

function checkpointById(id) {
  return CHECKPOINTS.find(checkpoint => checkpoint.id === id);
}

function checkpointPassed(id) {
  return Boolean(state.checkpoints[id]);
}

function themeIndex(themeId) {
  return THEMES.findIndex(theme => theme.id === themeId);
}

function blockIndexForTheme(themeId) {
  return Math.floor(themeIndex(themeId) / 6);
}

function themeUnlocked(themeId) {
  const block = blockIndexForTheme(themeId);
  if (block === 0) return true;
  return checkpointPassed(`checkpoint-${block}`);
}

function checkpointThemes(checkpoint) {
  const start = checkpoint.after - 6;
  return THEMES.slice(start, checkpoint.after);
}

function checkpointAvailable(checkpoint) {
  return Boolean(checkpoint);
}
function fullGerman(word) {
  return `${word.article ? word.article + " " : ""}${word.german}`;
}

function wordExample(word) {
  if (word.example) return word.example;
  if (word.article) return `Das ist ${word.article} ${word.german}.`;
  return `${word.german}.`;
}

function wordExplanation(word, correct, context = "") {
  const gender = word.article === "der" ? "masculino" : word.article === "die" ? "femenino" : word.article === "das" ? "neutro" : null;
  const headline = correct ? "¡Correcto!" : "Respuesta incorrecta";
  const grammar = gender ? ` Es un sustantivo ${gender} y lleva <b>${word.article}</b>.` : "";
  const correction = correct
    ? `<b>${escapeHTML(fullGerman(word))}</b> significa «${escapeHTML(word.spanish)}».`
    : `La respuesta correcta es <b>${escapeHTML(fullGerman(word))}</b>, «${escapeHTML(word.spanish)}».`;
  return `<strong>${headline}</strong><span>${correction}${grammar}${context ? " " + context : ""}</span><span class="feedback-example">Ejemplo: <i>${escapeHTML(wordExample(word).match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] || wordExample(word))}</i></span>`;
}

function feedbackDock(buttonId, label = "Continuar") {
  const session = state.session;
  if (!session?.feedback) return "";
  return `
    <aside class="feedback-dock ${session.feedbackTone === "wrong" ? "wrong" : "correct"}" aria-live="polite">
      <div class="feedback-dock-inner">
        <div class="feedback-copy">${session.feedback}</div>
        <button class="btn primary" id="${buttonId}">${label}</button>
      </div>
    </aside>
  `;
}

function isActivityScreen() {
  return ["session", "review-session", "checkpoint-session"].includes(state.screen);
}

async function persist(progress) {
  state.progress.set(progress.wordId, progress);
  try {
    await saveProgress(progress);
  } catch (error) {
    state.storageAvailable = false;
    console.warn("FLSHD: progress persistence unavailable", error);
  }
}

function topicWords(topicId) {
  return byTheme(topicId);
}

function topicProgress(topicId) {
  const words = topicWords(topicId);
  if (!words.length) return 0;

  const points = words.reduce((sum, word) => {
    const p = progressFor(word.id);
    const step = p.mastered ? 3 : Math.min(3, p.bestLearningStep || 0);
    return sum + step;
  }, 0);

  return Math.round((points / (words.length * 3)) * 100);
}

function learnedCount() {
  return WORDS.filter(word => progressFor(word.id).mastered).length;
}

function dueWords() {
  return buildReviewQueue(WORDS, state.progress);
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div class="brand">FL<span>SH</span>D 🇩🇪</div>
      <div class="top-stats">
        <span class="stat-pill">⭐ ${learnedCount()} / ${WORDS.length}</span>
        <span class="stat-pill">🧠 ${dueWords().length} por repasar</span>
        <button type="button" id="openAccount" class="account-button" aria-label="Cuenta" title="Cuenta y sincronización">👤 <span id="cloudIndicator">${state.account ? (state.cloudStatus==="synced"?"✓":"…") : ""}</span></button>
      </div>
    </header>
  `;
}

function syncNav() {
  for (const button of navButtons) {
    button.classList.toggle("active", button.dataset.tab === state.tab);
  }

  const due = dueWords().length;
  reviewBadge.textContent = String(due);
  reviewBadge.classList.toggle("hidden", due === 0);
}

// Use the actually visible viewport, including Safari's changing browser chrome
// and the on-screen keyboard, rather than the layout viewport.
function syncActivityViewport() {
  if (!isActivityScreen()) return;
  const viewport = window.visualViewport;
  const height = Math.floor(viewport?.height || window.innerHeight);
  const width = Math.floor(viewport?.width || window.innerWidth);
  root.style.setProperty("--activity-height", height + "px");
  root.style.setProperty("--activity-width", width + "px");
  root.style.setProperty("--activity-top", (viewport?.offsetTop || 0) + "px");
  root.style.setProperty("--activity-left", (viewport?.offsetLeft || 0) + "px");
  root.classList.toggle("short-activity", height < 560);
  root.classList.toggle("tiny-activity", height < 380);
  root.classList.toggle("typing-activity", Boolean(root.querySelector(".answer-input:not(:disabled)")));
}

function layoutActivity() {
  const active = isActivityScreen();
  document.documentElement.classList.toggle("activity-mode", active);
  if (!active) return;
  const screen = root.querySelector(".activity-screen");
  if (!screen) return;
  // Place actions and feedback in the actual bottom row, not relative to a
  // potentially larger browser viewport. Keep their event IDs unchanged.
  const dock = screen.querySelector(".feedback-dock, .activity-actions");
  if (dock && dock.parentElement !== screen) screen.appendChild(dock);
  syncActivityViewport();
}

window.addEventListener("resize", syncActivityViewport);
window.visualViewport?.addEventListener("resize", syncActivityViewport);
window.visualViewport?.addEventListener("scroll", syncActivityViewport);

function render() {
  syncNav();
  document.body.classList.toggle("activity-mode", isActivityScreen());

  let content = "";
  if (state.screen === "account") content = renderAccount();
  else if (state.screen === "topic") content = renderTopicIntro();
  else if (state.screen === "session") content = renderLearningSession();
  else if (state.screen === "review-session") content = renderReviewSession();
  else if (state.screen === "checkpoint-session") content = renderCheckpointSession();
  else if (state.tab === "learn") content = renderHome();
  else if (state.tab === "review") content = renderReviewPage();
  else content = renderProgressPage();

  root.innerHTML = (isActivityScreen() ? "" : renderTopbar()) + content;
  layoutActivity();
  bind();
}

function renderHome() {
  const nodes = [];
  THEMES.forEach((theme, index) => {
    if (index % BLOCK_SIZE === 0) {
      const blockNumber = Math.floor(index / BLOCK_SIZE) + 1;
      nodes.push(`<div class="block-label"><span>Bloque ${blockNumber}</span><small>6 actividades</small></div>`);
    }

    const progress = topicProgress(theme.id);
    const unlocked = themeUnlocked(theme.id);
    const status = unlocked
      ? (progress === 100 ? "✓ Completado" : progress > 0 ? "En progreso" : "Por descubrir")
      : "🔒 Bloqueado";
    const statusClass = !unlocked ? "locked" : progress === 100 ? "done" : progress > 0 ? "partial" : "";

    nodes.push(`
      <button class="topic-node ${index % 3 === 1 ? "middle-node" : "outer-node"}${unlocked ? "" : " locked"}" data-topic="${theme.id}"
        aria-label="${escapeHTML(theme.name)}, ${unlocked ? progress + "% completado" : "bloqueado"}">
        <span class="topic-index">${index + 1}</span>
        <span class="progress-ring" role="progressbar" aria-valuemin="0" aria-valuemax="100"
          aria-valuenow="${progress}" style="--p:${progress};--tone:${theme.tone}">
          <span class="ring-inner" aria-hidden="true">${theme.icon}</span>
          ${unlocked ? "" : '<span class="lock-mark">🔒</span>'}
        </span>
        <strong>${escapeHTML(theme.name)}</strong>
        <small>${progress}% aprendido</small>
        <span class="topic-state ${statusClass}">${status}</span>
      </button>
    `);

    const checkpoint = CHECKPOINTS.find(item => item.after === index + 1);
    if (checkpoint) {
      const passed = checkpointPassed(checkpoint.id);
      nodes.push(`
        <div class="checkpoint-row">
          <span class="checkpoint-line"></span>
          <button class="checkpoint-node ${passed ? "passed" : "available"}"
            data-checkpoint="${checkpoint.id}" aria-label="${escapeHTML(checkpoint.title)}">
            <span class="checkpoint-circle">${passed ? "✓" : checkpoint.icon}</span>
            <strong>${escapeHTML(checkpoint.title)}</strong>
            <small>${passed ? "Superada" : "Hazla cuando quieras"}</small>
          </button>
          <span class="checkpoint-line"></span>
        </div>
      `);
    }
  });

  return `
    <section class="home-heading">
      <div>
        <h1>Tu camino de alemán 🇩🇪</h1>
        <p>Supera cada prueba perfecta para desbloquear el siguiente bloque.</p>
      </div>
    </section>

    <section class="learning-path" aria-label="Temas y pruebas de nivel">
      ${nodes.join("")}
    </section>

    ${state.storageAvailable ? "" : '<div class="home-note"><b>Aviso:</b> el navegador no está permitiendo guardar datos de forma permanente.</div>'}
  `;
}
function renderTopicIntro() {
  const theme = themeById(state.topicId);
  const words = topicWords(theme.id);
  const mastered = words.filter(word => progressFor(word.id).mastered).length;
  const photos = words.filter(word => state.images.has(word.id)).length;
  const unlocked = themeUnlocked(theme.id);

  if (!unlocked) {
    return `
      <section class="page-head">
        <button class="back-btn" id="backHome" aria-label="Volver">←</button>
        <div>
          <h1>🔒 ${theme.icon} ${escapeHTML(theme.name)}</h1>
          <p>Este bloque todavía no está desbloqueado.</p>
        </div>
      </section>

      <div class="review-card locked-topic-card">
        <h2>Puedes mirar el vocabulario</h2>
        <p class="muted small">Supera la prueba de nivel anterior para poder practicar este tema.</p>
      </div>

      <div class="vocab-list">
        ${words.map(word => `
          <div class="vocab-row">
            <span class="vocab-icon">${word.icon}</span>
            <div>
              <b>${escapeHTML(fullGerman(word))}</b>
              ${word.plural ? `<small>Plural: ${escapeHTML(word.plural)}</small>` : ""}
              <small>${escapeHTML(word.spanish)}</small>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  return `
    <section class="page-head">
      <button class="back-btn" id="backHome" aria-label="Volver">←</button>
      <div>
        <h1>${theme.icon} ${escapeHTML(theme.name)}</h1>
        <p>${escapeHTML(theme.description)}</p>
      </div>
    </section>

    <div class="review-card">
      <h2>${mastered} de ${words.length} dominadas</h2>
      <p class="muted small">Tienes ${photos} fotos personales asociadas a este tema.</p>
      <div class="master-bar"><div style="width:${topicProgress(theme.id)}%"></div></div>
    </div>

    <div class="stage-strip" aria-label="Etapas">
      <div class="stage-chip active">1 · 🃏 Flashcards</div>
      <div class="stage-chip">2 · 🎯 Reconocer</div>
      <div class="stage-chip">3 · ✍️ Escribir</div>
    </div>

    <div class="review-card">
      <h2>Cómo funciona</h2>
      <p class="muted small">
        Primero verás cada palabra como una tarjeta. Después tendrás preguntas variadas: significado, fotografía,
        traducción inversa y artículo. La última fase exige escribir la palabra.
      </p>
      <button class="btn primary" id="startTopic">Empezar este tema</button>
    </div>
  `;
}
function startTopic(topicId) {
  const remaining = topicWords(topicId).filter(word => !progressFor(word.id).mastered);

  if (!remaining.length) {
    state.session = {
      type: "learning",
      topicId,
      phase: "complete",
      cycle: 1,
      queue: [],
      index: 0
    };
  } else {
    state.session = {
      type: "learning",
      topicId,
      phase: "flashcard",
      cycle: 1,
      queue: remaining.map(word => word.id),
      index: 0,
      revealed: false,
      articleRevealed: false,
      answered: false,
      feedback: null,
      selected: null
    };
  }

  state.screen = "session";
  render();
}

function stageMarkup(activePhase) {
  return `
    <div class="stage-strip">
      ${PHASES.map((phase, index) => {
        const phaseIndex = PHASES.indexOf(activePhase);
        const cls = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "";
        const labels = ["1 · 🃏 Flashcards", "2 · 🎯 Elegir", "3 · ✍️ Escribir"];
        return `<div class="stage-chip ${cls}">${labels[index]}</div>`;
      }).join("")}
    </div>
  `;
}

function sessionWord() {
  return wordById(state.session?.queue[state.session?.index]);
}

function sessionProgressPercent() {
  const session = state.session;
  if (!session?.queue.length) return 100;
  return Math.round((session.index / session.queue.length) * 100);
}

function imageMarkup(word, className = "word-photo") {
  const record = state.images.get(word.id);
  if (record?.dataUrl) {
    return `<img class="${className}" src="${record.dataUrl}" alt="Tu foto para ${escapeHTML(word.spanish)}">`;
  }
  return `<div class="photo-placeholder" aria-label="Sin fotografía">${word.icon}</div>`;
}

function articleMarkup(word) {
  if (!word.article) return "";
  return `
    <button type="button" class="article-dot ${word.article}" id="articleDot" aria-label="Revelar artículo"></button>
    ${state.session.articleRevealed ? `<span class="article-reveal">${word.article}</span>` : ""}
  `;
}

function renderLearningSession() {
  const session = state.session;
  const theme = themeById(session.topicId);

  if (session.phase === "complete") {
    return `
      <section class="activity-screen activity-complete">
        <div class="celebrate">
          <div class="emoji">🏆</div>
          <h2>¡Tema dominado!</h2>
          <p>Estas palabras ya han entrado en tu sistema de repetición. La primera revisión aparecerá dentro de 3 días.</p>
          <button class="btn primary" id="finishTopic">Volver al camino</button>
        </div>
      </section>
    `;
  }

  const word = sessionWord();
  const count = `${Math.min(session.index + 1, session.queue.length)} / ${session.queue.length}`;

  let body = "";
  if (session.phase === "flashcard") body = renderFlashcard(word);
  if (session.phase === "choice") body = renderChoiceQuestion(word);
  if (session.phase === "typing") body = renderTypingQuestion(word);

  return `
    <section class="activity-screen">
      <header class="activity-header">
        <button class="back-btn" id="leaveSession">←</button>
        <div class="activity-title"><b>${theme.icon} ${escapeHTML(theme.name)}</b><small>Ciclo ${session.cycle}</small></div>
        <span class="activity-count">${count}</span>
      </header>
      ${stageMarkup(session.phase)}
      <div class="session-progress"><div style="width:${sessionProgressPercent()}%"></div></div>
      <main class="activity-main">
        ${body}
      </main>
    </section>
  `;
}
function renderFlashcard(word) {
  const revealed = state.session.revealed;

  return `
    <article class="study-card" id="studyCard">
      <span class="swipe-hint known" id="knownHint">ME LA SÉ ✓</span>
      <span class="swipe-hint unknown" id="unknownHint">NO LA SABÍA</span>

      ${imageMarkup(word)}
      <label class="upload-label">
        📷 ${state.images.has(word.id) ? "Cambiar mi foto" : "Subir / hacer foto"}
        <input id="photoInput" type="file" accept="image/*" capture="environment">
      </label>

      <div class="flip-copy">${revealed ? "Toca la tarjeta para ocultar" : "Toca la tarjeta para revelar la palabra"}</div>
      <div class="answer-word">
        ${articleMarkup(word)}
        ${revealed ? escapeHTML(word.german) : "••••••"}
      </div>
      ${revealed && word.plural ? `<div class="small muted">Plural: ${escapeHTML(word.plural)}</div>` : ""}
      <p class="translation">${escapeHTML(word.spanish)}</p>
    </article>

    <div class="activity-actions split">
      <button class="btn danger" id="didntKnow">← No la sabía</button>
      <button class="btn primary" id="knewIt">Me la sé →</button>
    </div>
  `;
}
function optionCandidates(word) {
  const sameTheme = topicWords(word.themeId).filter(candidate => candidate.id !== word.id);
  const widerPool = WORDS.filter(candidate => candidate.id !== word.id && candidate.themeId !== word.themeId);
  const pool = sameTheme.length >= 3 ? sameTheme : [...sameTheme, ...widerPool];
  const shuffled = [...pool].sort(() => Math.random() - .5).slice(0, 3);
  return [word, ...shuffled].sort(() => Math.random() - .5);
}

function prepareChoiceQuestion(word) {
  const session = state.session;
  if (session.optionWordId === word.id && session.options?.length) return;

  const kinds = ["translation", "image", "reverse", "article"];
  let kind = kinds[(session.index + (session.cycle || 0)) % kinds.length];
  if (kind === "article" && !word.article) kind = "reverse";

  session.optionWordId = word.id;
  session.questionKind = kind;

  if (kind === "article") {
    session.options = [
      { value: "article:der", label: "der" },
      { value: "article:die", label: "die" },
      { value: "article:das", label: "das" },
      { value: "article:none", label: "sin artículo" }
    ];
    session.correctChoice = `article:${word.article || "none"}`;
    return;
  }

  const candidates = optionCandidates(word);
  session.options = candidates.map(candidate => ({
    value: candidate.id,
    label: kind === "reverse" ? candidate.spanish : candidate.german
  }));
  session.correctChoice = word.id;
}
function renderChoiceQuestion(word) {
  const session = state.session;
  prepareChoiceQuestion(word);

  const kind = session.questionKind;
  const question = kind === "image"
    ? "¿Cómo se llama esto en alemán?"
    : kind === "reverse"
      ? "¿Qué significa esta palabra?"
      : kind === "article"
        ? "¿Qué artículo lleva esta palabra?"
        : "¿Cuál es la palabra alemana?";

  let prompt = "";
  if (kind === "image") {
    prompt = imageMarkup(word, "question-photo");
  } else if (kind === "reverse") {
    prompt = `<div class="prompt">${escapeHTML(word.german)}</div>`;
  } else if (kind === "article") {
    prompt = `<div class="prompt">${escapeHTML(word.german)}</div><p class="small muted">Elige der, die, das o “sin artículo”.</p>`;
  } else {
    prompt = `<div class="prompt">${escapeHTML(word.spanish)}</div>`;
  }

  return `
    <section class="question-card compact-question">
      <h2>${question}</h2>
      ${prompt}
      ${kind === "image" && !state.images.has(word.id) ? '<p class="small muted">Aún no has subido foto: usamos el icono como apoyo.</p>' : ""}
    </section>

    <div class="options-grid">
      ${session.options.map(option => {
        let cls = "";
        if (session.answered && option.value === session.correctChoice) cls = "correct";
        if (session.answered && option.value === session.selected && option.value !== session.correctChoice) cls = "wrong";
        return `
          <button class="option ${cls}" data-option="${escapeHTML(option.value)}" ${session.answered ? "disabled" : ""}>
            ${escapeHTML(option.label)}
          </button>
        `;
      }).join("")}
    </div>

    ${feedbackDock("continueQuestion")}
  `;
}
function renderTypingQuestion(word) {
  const session = state.session;

  return `
    <section class="question-card compact-question">
      <h2>Escribe la palabra alemana</h2>
      ${imageMarkup(word, "question-photo")}
      <p class="translation">${escapeHTML(word.spanish)}</p>
      <input id="typingAnswer" class="answer-input" type="text" autocomplete="off" autocapitalize="off"
        spellcheck="false" placeholder="Escribe en alemán…" ${session.answered ? "disabled" : ""}>
      <p class="small muted">Mayúsculas y minúsculas no importan. Puedes escribir el sustantivo con o sin artículo.</p>
    </section>

    ${session.answered
      ? feedbackDock("continueQuestion")
      : '<div class="activity-actions"><button class="btn primary" id="checkTyping">Comprobar</button></div>'}
  `;
}
async function flashcardResult(knew) {
  const word = sessionWord();
  let p = progressFor(word.id);
  const now = dateOnly();

  if (knew) {
    p = {
      ...p,
      known: true,
      learningStep: 1,
      bestLearningStep: Math.max(p.bestLearningStep || 0, 1),
      flashcardSeenCount: (p.flashcardSeenCount || 0) + 1,
      lastSeenAt: now,
      lastSuccessAt: now,
      correctCount: (p.correctCount || 0) + 1
    };
  } else {
    p = scheduleFailure({
      ...p,
      flashcardSeenCount: (p.flashcardSeenCount || 0) + 1
    }, now);
    // A missed flashcard must be seen again before leaving phase 1.
    state.session.queue.push(word.id);
  }

  await persist(p);
  nextLearningItem();
}

async function choiceResult(optionId) {
  const session = state.session;
  if (session.answered) return;

  const word = sessionWord();
  const correct = optionId === session.correctChoice;
  let p = progressFor(word.id);
  const now = dateOnly();

  session.answered = true;
  session.selected = optionId;
  session.feedbackTone = correct ? "correct" : "wrong";

  if (correct) {
    const cleanNext = p.learningStep === 1 ? 2 : 0;
    p = {
      ...p,
      known: true,
      learningStep: cleanNext,
      bestLearningStep: Math.max(p.bestLearningStep || 0, cleanNext),
      lastSeenAt: now,
      lastSuccessAt: now,
      correctCount: (p.correctCount || 0) + 1
    };
    session.feedback = wordExplanation(
      word,
      true,
      cleanNext === 2 ? "Has completado correctamente esta fase." : "La palabra seguirá reforzándose porque la secuencia anterior no estaba limpia."
    );
  } else {
    p = scheduleFailure(p, now);
    session.queue.push(word.id);
    session.feedback = wordExplanation(word, false, "Volverá a aparecer para que la consolides.");
  }

  await persist(p);
  render();
}
function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/^(der|die|das)\s+/, "")
    .replace(/\s+/g, " ");
}

async function typingResult() {
  if (state.session.answered) return;

  const input = document.querySelector("#typingAnswer");
  const word = sessionWord();
  const value = input?.value || "";
  if (!value.trim()) return;

  const correct = normalizeAnswer(value) === normalizeAnswer(word.german);
  const now = dateOnly();
  let p = progressFor(word.id);

  state.session.answered = true;
  state.session.feedbackTone = correct ? "correct" : "wrong";

  if (correct && p.learningStep === 2) {
    p = scheduleNewlyLearned({
      ...p,
      learningStep: 3,
      bestLearningStep: 3
    }, now);
    state.session.feedback = wordExplanation(word, true, "Has completado las tres fases y esta palabra entra en repetición espaciada.");
  } else if (correct) {
    p = {
      ...p,
      known: true,
      learningStep: 0,
      lastSeenAt: now,
      lastSuccessAt: now,
      correctCount: (p.correctCount || 0) + 1
    };
    state.session.feedback = wordExplanation(word, true, "La respuesta es correcta, pero repetirás un ciclo corto porque hubo un fallo previo.");
  } else {
    p = scheduleFailure(p, now);
    state.session.queue.push(word.id);
    state.session.feedback = wordExplanation(word, false, "Volverá a aparecer antes de poder considerarla aprendida.");
  }

  await persist(p);
  render();
}
function resetQuestionState() {
  const session = state.session;
  session.revealed = false;
  session.articleRevealed = false;
  session.answered = false;
  session.feedback = null;
  session.feedbackTone = null;
  session.selected = null;
  session.options = null;
  session.optionWordId = null;
  session.correctChoice = null;
  session.questionKind = null;
}
function nextLearningItem() {
  state.session.index += 1;
  resetQuestionState();

  if (state.session.index < state.session.queue.length) {
    render();
    return;
  }

  const topicId = state.session.topicId;
  const unmastered = topicWords(topicId).filter(word => !progressFor(word.id).mastered);

  if (state.session.phase === "flashcard") {
    state.session.phase = "choice";
    state.session.queue = unmastered.map(word => word.id);
    state.session.index = 0;
  } else if (state.session.phase === "choice") {
    state.session.phase = "typing";
    state.session.queue = unmastered.map(word => word.id);
    state.session.index = 0;
  } else if (!unmastered.length) {
    state.session.phase = "complete";
    state.session.queue = [];
    state.session.index = 0;
  } else {
    state.session.phase = "flashcard";
    state.session.cycle += 1;
    state.session.queue = unmastered.map(word => word.id);
    state.session.index = 0;
  }

  resetQuestionState();
  render();
}


function checkpointPool(checkpoint) {
  const ids = new Set(checkpointThemes(checkpoint).map(theme => theme.id));
  return WORDS.filter(word => ids.has(word.themeId));
}

function buildCheckpointQueue(checkpoint) {
  const selected = [];
  const selectedIds = new Set();

  // Give every activity in the block representation first.
  for (const theme of checkpointThemes(checkpoint)) {
    const picks = [...topicWords(theme.id)].sort(() => Math.random() - .5).slice(0, 2);
    for (const word of picks) {
      if (!selectedIds.has(word.id)) {
        selected.push(word);
        selectedIds.add(word.id);
      }
    }
  }

  // Very short activities may provide fewer than two cards. Fill the test from
  // the rest of the same six-activity block until the target length is reached.
  const remainder = checkpointPool(checkpoint)
    .filter(word => !selectedIds.has(word.id))
    .sort(() => Math.random() - .5);

  while (selected.length < checkpoint.questionCount && remainder.length) {
    selected.push(remainder.shift());
  }

  return selected.sort(() => Math.random() - .5)
    .slice(0, checkpoint.questionCount)
    .map(word => word.id);
}

function startCheckpoint(checkpointId) {
  const checkpoint = checkpointById(checkpointId);
  if (!checkpoint) return;

  state.session = {
    type: "checkpoint",
    checkpointId,
    queue: buildCheckpointQueue(checkpoint),
    index: 0,
    answered: false,
    selected: null,
    feedback: null,
    feedbackTone: null,
    optionWordId: null,
    options: null,
    correctChoice: null,
    questionKind: null,
    result: null,
    failedWordId: null
  };
  state.screen = "checkpoint-session";
  render();
}
function prepareCheckpointQuestion(word) {
  const session = state.session;
  if (session.optionWordId === word.id && session.questionKind) return;

  const kinds = ["translation", "image", "reverse", "article", "typing"];
  let kind = kinds[session.index % kinds.length];
  if (kind === "article" && !word.article) kind = "image";

  session.questionKind = kind;
  session.optionWordId = word.id;
  session.options = null;
  session.correctChoice = null;

  if (kind === "typing") return;

  if (kind === "article") {
    session.options = [
      { value: "article:der", label: "der" },
      { value: "article:die", label: "die" },
      { value: "article:das", label: "das" },
      { value: "article:none", label: "sin artículo" }
    ];
    session.correctChoice = `article:${word.article || "none"}`;
    return;
  }

  const pool = checkpointPool(checkpointById(session.checkpointId)).filter(candidate => candidate.id !== word.id);
  const candidates = [word, ...pool.sort(() => Math.random() - .5).slice(0, 3)].sort(() => Math.random() - .5);
  session.options = candidates.map(candidate => ({
    value: candidate.id,
    label: kind === "reverse" ? candidate.spanish : candidate.german
  }));
  session.correctChoice = word.id;
}

function renderCheckpointSession() {
  const session = state.session;
  const checkpoint = checkpointById(session.checkpointId);

  if (session.result === "failed") {
    const word = wordById(session.failedWordId);
    return `
      <section class="activity-screen activity-complete">
        <div class="checkpoint-result failed">
          <div class="emoji">🧩</div>
          <h2>Prueba no superada</h2>
          <p>En esta prueba no se puede fallar ninguna pregunta. La próxima vez empezarás desde la primera, sin penalización ni límite de intentos.</p>
          <div class="checkpoint-correction">${wordExplanation(word, false, "Repasa esta palabra y vuelve a intentarlo cuando quieras.")}</div>
          <div class="action-row">
            <button class="btn secondary" id="exitCheckpoint">Volver</button>
            <button class="btn primary" id="retryCheckpoint">Probar otra vez</button>
          </div>
        </div>
      </section>
    `;
  }

  if (session.result === "passed") {
    return `
      <section class="activity-screen activity-complete">
        <div class="checkpoint-result passed">
          <div class="emoji">🔓</div>
          <h2>¡Prueba perfecta!</h2>
          <p>Has acertado todas las preguntas. El siguiente bloque de temas ya está desbloqueado.</p>
          <button class="btn primary" id="exitCheckpoint">Continuar</button>
        </div>
      </section>
    `;
  }

  const word = wordById(session.queue[session.index]);
  if (!word) return "";
  prepareCheckpointQuestion(word);

  const kind = session.questionKind;
  let question = "";
  let prompt = "";
  let answerArea = "";

  if (kind === "typing") {
    question = "Escribe la palabra alemana";
    prompt = imageMarkup(word, "question-photo");
    answerArea = `
      <input id="checkpointTyping" class="answer-input" autocomplete="off" autocapitalize="off"
        spellcheck="false" placeholder="Escribe la palabra…" ${session.answered ? "disabled" : ""}>
      ${session.answered ? "" : '<div class="activity-actions"><button class="btn primary" id="checkCheckpointTyping">Comprobar</button></div>'}
    `;
  } else {
    question = kind === "image"
      ? "¿Cómo se llama esto en alemán?"
      : kind === "reverse"
        ? "¿Qué significa esta palabra?"
        : kind === "article"
          ? "¿Qué artículo lleva?"
          : "¿Cuál es la palabra alemana?";

    prompt = kind === "image"
      ? imageMarkup(word, "question-photo")
      : `<div class="prompt">${escapeHTML(kind === "translation" ? word.spanish : word.german)}</div>`;

    answerArea = `
      <div class="options-grid">
        ${session.options.map(option => {
          let cls = "";
          if (session.answered && option.value === session.correctChoice) cls = "correct";
          return `<button class="option ${cls}" data-checkpoint-option="${escapeHTML(option.value)}" ${session.answered ? "disabled" : ""}>${escapeHTML(option.label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  return `
    <section class="activity-screen checkpoint-activity">
      <header class="activity-header">
        <button class="back-btn" id="exitCheckpoint">←</button>
        <div class="activity-title"><b>🏁 ${escapeHTML(checkpoint.title)}</b><small>0 errores permitidos</small></div>
        <span class="activity-count">${session.index + 1} / ${session.queue.length}</span>
      </header>
      <div class="session-progress"><div style="width:${Math.round(session.index / session.queue.length * 100)}%"></div></div>
      <main class="activity-main">
        <section class="question-card compact-question">
          <h2>${question}</h2>
          ${prompt}
          ${kind === "article" ? '<p class="small muted">Elige der, die, das o “sin artículo”.</p>' : ""}
          ${answerArea}
        </section>
      </main>
      ${feedbackDock("continueCheckpoint")}
    </section>
  `;
}

async function checkpointChoiceResult(value) {
  const session = state.session;
  if (session.answered) return;
  const word = wordById(session.queue[session.index]);

  if (value !== session.correctChoice) {
    session.result = "failed";
    session.failedWordId = word.id;
    session.feedback = null;
    render();
    return;
  }

  session.answered = true;
  session.selected = value;
  session.feedbackTone = "correct";
  session.feedback = wordExplanation(word, true, "Sigue así: la prueba exige una ronda perfecta.");
  render();
}

async function checkpointTypingResult() {
  const input = document.querySelector("#checkpointTyping");
  const session = state.session;
  const word = wordById(session.queue[session.index]);
  if (!input?.value.trim() || session.answered) return;

  if (normalizeAnswer(input.value) !== normalizeAnswer(word.german)) {
    session.result = "failed";
    session.failedWordId = word.id;
    render();
    return;
  }

  session.answered = true;
  session.feedbackTone = "correct";
  session.feedback = wordExplanation(word, true, "Sigue así: la prueba exige una ronda perfecta.");
  render();
}

async function continueCheckpoint() {
  const session = state.session;
  session.index += 1;
  session.answered = false;
  session.selected = null;
  session.feedback = null;
  session.feedbackTone = null;
  session.optionWordId = null;
  session.options = null;
  session.correctChoice = null;
  session.questionKind = null;

  if (session.index >= session.queue.length) {
    state.checkpoints[session.checkpointId] = true;
    session.result = "passed";
    try {
      await setMeta("checkpoints-v3", state.checkpoints);
    } catch (error) {
      state.storageAvailable = false;
      console.warn("Could not persist checkpoint state", error);
    }
  }

  render();
}

function renderReviewPage() {
  const due = dueWords();

  return `
    <section class="hero">
      <div class="eyebrow">Memoria a largo plazo</div>
      <h1>Repasar 🧠</h1>
      <p>Las palabras vencidas y las que más te cuestan aparecen primero.</p>
    </section>

    <div class="review-card">
      <h2>${due.length} palabras pendientes</h2>
      <p class="muted small">Ritmo base: 3 → 7 → 14 → 30 → 60 → 120 días. Si fallas, vuelve en 1–2 días y reinicia la progresión.</p>
      <button class="btn primary" id="startReview" ${due.length ? "" : "disabled"}>Empezar repaso</button>
    </div>

    <div class="review-list">
      ${due.length ? due.slice(0, 25).map(word => {
        const p = progressFor(word.id);
        return `
          <div class="review-row">
            <div><b>${escapeHTML(word.article ? word.article + " " : "")}${escapeHTML(word.german)}</b><small>${escapeHTML(word.spanish)}</small></div>
            <span class="urgency">${errorsInLastDays(p)} fallos · prioridad ${reviewUrgency(p).toFixed(1)}</span>
          </div>
        `;
      }).join("") : '<div class="empty-card">🌱 No tienes repasos vencidos. Sigue aprendiendo temas nuevos.</div>'}
    </div>
  `;
}

function startReview() {
  const due = dueWords();
  if (!due.length) return;

  state.session = {
    type: "review",
    queue: due.map(word => word.id),
    index: 0,
    answered: false,
    feedback: null,
    selected: null,
    options: null
  };
  state.screen = "review-session";
  render();
}

function renderReviewSession() {
  const session = state.session;
  const word = wordById(session.queue[session.index]);

  if (!word) {
    return `
      <section class="activity-screen activity-complete">
        <div class="celebrate">
          <div class="emoji">🧠✨</div>
          <h2>Repaso terminado</h2>
          <p>Has vaciado la cola de hoy.</p>
          <button class="btn primary" id="finishReview">Volver</button>
        </div>
      </section>
    `;
  }

  const typed = session.index % 3 === 1;
  const reverse = session.index % 3 === 2;

  let body;
  if (typed) {
    body = `
      <section class="question-card compact-question">
        <h2>¿Cómo se llama en alemán?</h2>
        ${imageMarkup(word, "question-photo")}
        <p class="translation">${escapeHTML(word.spanish)}</p>
        <input id="reviewTyping" class="answer-input" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="Escribe la palabra…" ${session.answered ? "disabled" : ""}>
      </section>
      ${session.answered
        ? feedbackDock("continueReview")
        : '<div class="activity-actions"><button class="btn primary" id="checkReviewTyping">Comprobar</button></div>'}
    `;
  } else {
    if (!session.options || session.optionWordId !== word.id) {
      const candidates = optionCandidates(word);
      session.options = candidates.map(item => ({ value:item.id, label: reverse ? item.spanish : item.german }));
      session.correctChoice = word.id;
      session.optionWordId = word.id;
    }
    body = `
      <section class="question-card compact-question">
        <h2>${reverse ? "¿Qué significa esta palabra?" : "Elige el nombre correcto"}</h2>
        ${reverse ? `<div class="prompt">${escapeHTML(word.german)}</div>` : imageMarkup(word, "question-photo")}
      </section>
      <div class="options-grid">
        ${session.options.map(option => {
          let cls = "";
          if (session.answered && option.value === session.correctChoice) cls = "correct";
          if (session.answered && option.value === session.selected && option.value !== session.correctChoice) cls = "wrong";
          return `<button class="option ${cls}" data-review-option="${option.value}" ${session.answered ? "disabled" : ""}>${escapeHTML(option.label)}</button>`;
        }).join("")}
      </div>
      ${feedbackDock("continueReview")}
    `;
  }

  return `
    <section class="activity-screen">
      <header class="activity-header">
        <button class="back-btn" id="leaveReview">←</button>
        <div class="activity-title"><b>🧠 Repaso</b><small>Errores recientes = más prioridad</small></div>
        <span class="activity-count">${session.index + 1} / ${session.queue.length}</span>
      </header>
      <div class="session-progress"><div style="width:${Math.round(session.index / session.queue.length * 100)}%"></div></div>
      <main class="activity-main">${body}</main>
    </section>
  `;
}
async function reviewResult(correct) {
  const word = wordById(state.session.queue[state.session.index]);
  let p = progressFor(word.id);
  const now = dateOnly();

  if (correct) {
    p = scheduleReviewSuccess(p, now);
    state.session.feedbackTone = "correct";
    state.session.feedback = wordExplanation(word, true, "El siguiente repaso queda programado automáticamente.");
  } else {
    p = scheduleFailure(p, now);
    state.session.queue.push(word.id);
    state.session.feedbackTone = "wrong";
    state.session.feedback = wordExplanation(word, false, "La volverás a ver al final de esta sesión y pronto otra vez.");
  }

  state.session.answered = true;
  await persist(p);
  render();
}
function continueReview() {
  state.session.index += 1;
  state.session.answered = false;
  state.session.feedback = null;
  state.session.feedbackTone = null;
  state.session.selected = null;
  state.session.options = null;
  state.session.optionWordId = null;
  state.session.correctChoice = null;
  render();
}

function renderProgressPage() {
  const mastered = learnedCount();
  const percent = Math.round(mastered / WORDS.length * 100);
  const totalErrors = [...state.progress.values()].reduce((sum, p) => sum + (p.totalErrorCount || 0), 0);

  return `
    <section class="hero">
      <div class="eyebrow">Tus datos</div>
      <h1>Progreso 📊</h1>
      <p>No solo cuenta cuántas palabras has visto, sino cuáles puedes recordar sin ayuda.</p>
    </section>

    <div class="stats-card">
      <h2>${mastered} palabras dominadas</h2>
      <p class="muted small">${dueWords().length} pendientes de repaso · ${totalErrors} errores registrados</p>
      <div class="master-bar"><div style="width:${percent}%"></div></div>
    </div>

    <div class="stats-card">
      <h2>Por tema</h2>
      ${THEMES.map(theme => {
        const progress = topicProgress(theme.id);
        return `
          <div class="topic-stat">
            <span>${theme.icon}</span>
            <div class="grow"><b>${escapeHTML(theme.name)}</b><div class="mini"><div style="width:${progress}%"></div></div></div>
            <b>${progress}%</b>
          </div>
        `;
      }).join("")}
    </div>

    <div class="stats-card">
      <h2>Artículos</h2>
      <p class="muted small">
        <span class="article-dot der"></span> der ·
        <span class="article-dot die"></span> die ·
        <span class="article-dot das"></span> das
      </p>
    </div>
  `;
}

function navigateTab(tab) {
  if(state.booting || state.accountBusy) return;
  state.tab = tab;
  state.topicId = null;
  state.session = null;
  state.screen = "home";
  render();
}

function bind() {
  document.querySelector("#openAccount")?.addEventListener("click",()=>{state.screen="account";render();});
  bindAccount();
  document.querySelectorAll("[data-topic]").forEach(button => {
    button.addEventListener("click", () => {
      state.topicId = button.dataset.topic;
      state.screen = "topic";
      render();
    });
  });

  document.querySelectorAll("[data-checkpoint]").forEach(button => {
    button.addEventListener("click", () => startCheckpoint(button.dataset.checkpoint));
  });

  document.querySelector("#continueLearning")?.addEventListener("click", () => {
    const theme = THEMES.find(item => themeUnlocked(item.id) && topicProgress(item.id) > 0 && topicProgress(item.id) < 100)
      || THEMES.find(item => themeUnlocked(item.id) && topicProgress(item.id) < 100)
      || THEMES.find(item => themeUnlocked(item.id))
      || THEMES[0];
    state.topicId = theme.id;
    state.screen = "topic";
    render();
  });

  document.querySelector("#openReview")?.addEventListener("click", () => navigateTab("review"));
  document.querySelector("#backHome")?.addEventListener("click", () => navigateTab("learn"));
  document.querySelector("#startTopic")?.addEventListener("click", () => {
    if (themeUnlocked(state.topicId)) startTopic(state.topicId);
  });
  document.querySelector("#finishTopic")?.addEventListener("click", () => navigateTab("learn"));
  document.querySelector("#leaveSession")?.addEventListener("click", () => {
    state.screen = "topic";
    state.session = null;
    render();
  });

  bindFlashcard();
  bindQuestions();

  document.querySelector("#startReview")?.addEventListener("click", startReview);
  document.querySelector("#leaveReview")?.addEventListener("click", () => navigateTab("review"));
  document.querySelector("#finishReview")?.addEventListener("click", () => navigateTab("review"));

  document.querySelectorAll("[data-review-option]").forEach(button => {
    button.addEventListener("click", async () => {
      if (state.session.answered) return;
      const word = wordById(state.session.queue[state.session.index]);
      state.session.selected = button.dataset.reviewOption;
      await reviewResult(button.dataset.reviewOption === word.id);
    });
  });

  document.querySelector("#checkReviewTyping")?.addEventListener("click", checkReviewTyping);
  document.querySelector("#reviewTyping")?.addEventListener("keydown", event => {
    if (event.key === "Enter") checkReviewTyping();
  });
  document.querySelector("#continueReview")?.addEventListener("click", continueReview);

  document.querySelectorAll("[data-checkpoint-option]").forEach(button => {
    button.addEventListener("click", () => checkpointChoiceResult(button.dataset.checkpointOption));
  });
  document.querySelector("#checkCheckpointTyping")?.addEventListener("click", checkpointTypingResult);
  document.querySelector("#checkpointTyping")?.addEventListener("keydown", event => {
    if (event.key === "Enter") checkpointTypingResult();
  });
  document.querySelector("#continueCheckpoint")?.addEventListener("click", continueCheckpoint);
  document.querySelector("#retryCheckpoint")?.addEventListener("click", () => startCheckpoint(state.session.checkpointId));
  document.querySelector("#exitCheckpoint")?.addEventListener("click", () => navigateTab("learn"));
}

function bindQuestions() {
  document.querySelectorAll("[data-option]").forEach(button => {
    button.addEventListener("click", () => choiceResult(button.dataset.option));
  });

  document.querySelector("#continueQuestion")?.addEventListener("click", nextLearningItem);
  document.querySelector("#checkTyping")?.addEventListener("click", typingResult);
  document.querySelector("#typingAnswer")?.addEventListener("keydown", event => {
    if (event.key === "Enter") typingResult();
  });
}

function bindFlashcard() {
  const card = document.querySelector("#studyCard");
  if (!card) return;

  const photoInput = document.querySelector("#photoInput");
  photoInput?.addEventListener("change", handlePhotoUpload);

  document.querySelector("#articleDot")?.addEventListener("click", event => {
    event.stopPropagation();
    state.session.articleRevealed = !state.session.articleRevealed;
    render();
  });

  card.addEventListener("click", event => {
    if (event.target.closest(".upload-label") || event.target.closest("#articleDot")) return;
    if (Math.abs(currentX) > 10) return;
    state.session.revealed = !state.session.revealed;
    render();
  });

  document.querySelector("#knewIt")?.addEventListener("click", () => animateSwipe(true));
  document.querySelector("#didntKnow")?.addEventListener("click", () => animateSwipe(false));

  let pointerId = null;
  let startX = 0;
  let currentX = 0;

  card.addEventListener("pointerdown", event => {
    if (event.target.closest(".upload-label") || event.target.closest("#articleDot")) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    currentX = 0;
    card.setPointerCapture(pointerId);
    card.classList.add("dragging");
  });

  card.addEventListener("pointermove", event => {
    if (pointerId !== event.pointerId) return;
    currentX = event.clientX - startX;
    card.style.setProperty("--drag", `${currentX}px`);

    const strength = Math.min(1, Math.abs(currentX) / 100);
    const knownHint = document.querySelector("#knownHint");
    const unknownHint = document.querySelector("#unknownHint");
    if (knownHint) knownHint.style.opacity = currentX > 0 ? strength : 0;
    if (unknownHint) unknownHint.style.opacity = currentX < 0 ? strength : 0;
  });

  const finishDrag = event => {
    if (pointerId !== event.pointerId) return;
    card.classList.remove("dragging");
    card.releasePointerCapture?.(pointerId);
    pointerId = null;

    if (Math.abs(currentX) >= 80) {
      animateSwipe(currentX > 0);
    } else {
      card.style.setProperty("--drag", "0px");
      const knownHint = document.querySelector("#knownHint");
      const unknownHint = document.querySelector("#unknownHint");
      if (knownHint) knownHint.style.opacity = 0;
      if (unknownHint) unknownHint.style.opacity = 0;
    }
  };

  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", finishDrag);
}

function animateSwipe(knew) {
  const card = document.querySelector("#studyCard");
  if (!card) return flashcardResult(knew);

  card.classList.add(knew ? "swipe-right" : "swipe-left");
  window.setTimeout(() => flashcardResult(knew), 170);
}

async function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;

  const word = sessionWord();
  try {
    const dataUrl = await compressImage(file);
    const image = { id: `img-${word.id}`, wordId: word.id, dataUrl, updatedAt: new Date().toISOString() };
    state.images.set(word.id, image);
    await saveWordImage(word.id, dataUrl);
  } catch (error) {
    state.storageAvailable = false;
    console.warn("FLSHD: could not persist photo", error);
  }
  render();
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("La imagen no es válida."));
      image.onload = () => {
        const maxSide = 1100;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        let encoded=canvas.toDataURL("image/jpeg",.78);
        for(let attempt=0;encoded.length>430000&&attempt<6;attempt++){
          const reduced=document.createElement("canvas");
          reduced.width=Math.max(1,Math.round(canvas.width*.75));
          reduced.height=Math.max(1,Math.round(canvas.height*.75));
          reduced.getContext("2d").drawImage(canvas,0,0,reduced.width,reduced.height);
          canvas.width=reduced.width;canvas.height=reduced.height;
          canvas.getContext("2d").drawImage(reduced,0,0);
          encoded=canvas.toDataURL("image/jpeg",.72);
        }
        if(encoded.length>430000){reject(new Error("La fotografía es demasiado grande"));return;}
        resolve(encoded);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function checkReviewTyping() {
  const input = document.querySelector("#reviewTyping");
  const word = wordById(state.session.queue[state.session.index]);
  if (!input?.value.trim()) return;
  await reviewResult(normalizeAnswer(input.value) === normalizeAnswer(word.german));
}

for (const button of navButtons) {
  button.addEventListener("click", () => navigateTab(button.dataset.tab));
}


function cloudStatusText() {
  if(!cloudConfigured) return "Base de datos local · Supabase pendiente de configurar";
  if(!cloudReady()) return "No se pudo conectar con Supabase";
  if(!state.account) return "Modo invitado · datos en este navegador";
  return ({syncing:"Sincronizando…",synced:"Cambios enviados a la nube",pending:"Cambios pendientes de sincronizar",local:"Datos locales"})[state.cloudStatus] || "Datos locales";
}
function reportCloud(status,error) {
  state.cloudStatus=status;
  state.cloudError=error ? "No se ha podido sincronizar. Tus cambios guardados localmente se conservan para reintentar." : "";
  const badge=document.querySelector("#cloudIndicator");
  if(badge) badge.textContent=state.account?(status==="synced"?"✓":status==="pending"?"!":"…"):"";
  const line=document.querySelector("#cloudStatus");
  if(line) line.textContent=cloudStatusText();
  const detail=document.querySelector("#cloudError");
  if(detail) detail.textContent=state.cloudError;
}
function renderAccount(){
  const user=state.account;
  return `
    <section class="page-head"><button class="back-btn" id="backHome" aria-label="Volver">←</button><div><h1>Mi cuenta</h1><p>Tu alemán, en tus dispositivos</p></div></section>
    <section class="review-card account-card">
      <h2>${user ? escapeHTML(user.email || "Mi cuenta") : "Inicia sesión"}</h2>
      <p id="cloudStatus" class="muted small">${escapeHTML(cloudStatusText())}</p>
      <p id="cloudError" class="account-error" role="status">${escapeHTML(state.cloudError)}</p>
      ${!cloudConfigured ? '<p>El acceso con cuenta se activará cuando esté configurado el proyecto Supabase. Puedes seguir estudiando en modo local.</p>' : !cloudReady() ? '<button class="btn secondary" id="retryCloud">Reintentar conexión</button>' : user ? `
        <p>Fotos, palabras, errores, fechas de repaso y pruebas superadas pertenecen a esta cuenta.</p>
        <div class="account-actions">
          <button class="btn primary" id="syncAccount">Sincronizar ahora</button>
          <button class="btn secondary" id="importGuest">Importar mis datos anteriores</button>
          <button class="btn secondary" id="signOut">Cerrar sesión</button>
        </div>
        <p class="small muted">Cerrar sesión no borra tus datos. Si hay cambios pendientes, primero debes sincronizarlos.</p>
      ` : `
        <form id="authForm" class="account-form">
          <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
          <label>Contraseña<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
          <button type="submit" class="btn primary">Iniciar sesión</button>
          <button type="button" id="signUp" class="btn secondary">Crear cuenta</button>
        </form>
        <p class="small muted">Puedes seguir como invitado. Al crear una cuenta podrás importar tus datos locales desde este navegador.</p>
      `}
      <p id="accountMessage" role="status" class="account-message"></p>
    </section>`;
}
async function loadLocalState(){
  const [progress, images, checkpoints]=await Promise.all([getAllProgress(),getAllImages(),getMeta("checkpoints-v3",{})]);
  state.progress=progress;
  state.images=images;
  state.checkpoints={...(checkpoints||{})};
}
function bindAccount(){
  const form=document.querySelector("#authForm");
  const message=document.querySelector("#accountMessage");
  async function run(fn){
    if(state.accountBusy)return;
    state.accountBusy=true;
    const controls=[...document.querySelectorAll(".account-card button,.account-card input,#backHome,#openAccount")];
    controls.forEach(el=>el.disabled=true);
    if(message)message.textContent="Procesando…";
    try{const result=await fn();if(message)message.textContent=result||"";}
    catch(error){if(message)message.textContent="No se pudo completar: "+(error?.message||"Revisa la conexión e inténtalo de nuevo.");}
    finally{state.accountBusy=false;controls.forEach(el=>el.disabled=false);}
  }
  const credentials=()=>({email:form.elements.email.value.trim(),password:form.elements.password.value});
  form?.addEventListener("submit",event=>{event.preventDefault();const c=credentials();run(()=>signIn(c.email,c.password));});
  document.querySelector("#signUp")?.addEventListener("click",()=>{
    if(!form.reportValidity())return;const c=credentials();
    run(async()=>{const immediate=await signUp(c.email,c.password);return immediate?"Cuenta creada.":"Revisa tu correo para confirmar la cuenta y después inicia sesión.";});
  });
  document.querySelector("#retryCloud")?.addEventListener("click",()=>location.reload());
  document.querySelector("#syncAccount")?.addEventListener("click",()=>run(async()=>{
    await synchronize(true);await loadLocalState();return "Sincronización completada.";
  }));
  document.querySelector("#signOut")?.addEventListener("click",()=>run(()=>signOut()));
  document.querySelector("#importGuest")?.addEventListener("click",()=>{
    if(!window.confirm("¿Copiar las fotos y el progreso del modo invitado de este navegador a tu cuenta? No se borrará el original."))return;
    run(async()=>{
      await synchronize(true);
      const count=await importGuestData(new Set(WORDS.map(w=>w.id)));
      await loadLocalState();
      await synchronize(true);await loadLocalState();
      return count+" registros locales importados y sincronizados.";
    });
  });
}

async function init() {
  try {
    state.account=await initializeCloud(reportCloud);
  } catch(error) {
    state.cloudError="No se pudo abrir la sesión. Reintenta desde Mi cuenta; mientras tanto estás en modo invitado.";
  }
  try {
    configureLocalAccount(state.account?.id,queueCloudSync);
    await seedWords(WORDS);
    await loadLocalState();
    if(state.account) {
      try { await synchronize(true); await loadLocalState(); }
      catch(error) { /* Local state remains available when the network fails. */ }
    }
  } catch (error) {
    state.storageAvailable = false;
    console.warn("FLSHD is running without persistent storage.", error);
  }
  state.booting=false;
  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker unavailable", error));
  }
}
init();
