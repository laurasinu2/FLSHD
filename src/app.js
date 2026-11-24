import { THEMES, WORDS, byTheme, themeById, wordById } from "./data.js";
import {
  seedWords,
  defaultProgress,
  getAllProgress,
  getAllImages,
  saveProgress,
  saveWordImage,
  getMeta,
  setMeta
} from "./db.js";
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
  checkpoints: {
    "checkpoint-1": false,
    "checkpoint-2": false
  }
};

const CHECKPOINTS = [
  { id: "checkpoint-1", after: 6, title: "Prueba de nivel 1", icon: "🏁", questionCount: 12 },
  { id: "checkpoint-2", after: 12, title: "Prueba de nivel 2", icon: "🏆", questionCount: 12 }
];

const WORD_EXAMPLES = {
  "saludos-hallo": "Hallo! Wie geht’s?",
  "saludos-danke": "Danke für deine Hilfe.",
  "saludos-bitte": "Ein Kaffee, bitte.",
  "saludos-tschuess": "Tschüss! Bis morgen.",
  "saludos-guten-morgen": "Guten Morgen, Anna!",
  "verbos-lernen": "Ich lerne Deutsch.",
  "verbos-sprechen": "Ich spreche ein bisschen Deutsch.",
  "verbos-arbeiten": "Ich arbeite in Zürich.",
  "verbos-gehen": "Ich gehe nach Hause.",
  "verbos-essen": "Ich esse einen Apfel."
};

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
  if (block === 1) return checkpointPassed("checkpoint-1");
  return checkpointPassed("checkpoint-2");
}

function checkpointThemes(checkpoint) {
  const start = checkpoint.after - 6;
  return THEMES.slice(start, checkpoint.after);
}

function checkpointAvailable(checkpoint) {
  return checkpointThemes(checkpoint).every(theme => topicProgress(theme.id) === 100);
}

function fullGerman(word) {
  return `${word.article ? word.article + " " : ""}${word.german}`;
}

function wordExample(word) {
  if (WORD_EXAMPLES[word.id]) return WORD_EXAMPLES[word.id];
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
  return `<strong>${headline}</strong><span>${correction}${grammar}${context ? " " + context : ""}</span><span class="feedback-example">Ejemplo: <i>${escapeHTML(wordExample(word))}</i></span>`;
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

function render() {
  syncNav();
  document.body.classList.toggle("activity-mode", isActivityScreen());

  let content = "";
  if (state.screen === "topic") content = renderTopicIntro();
  else if (state.screen === "session") content = renderLearningSession();
  else if (state.screen === "review-session") content = renderReviewSession();
  else if (state.screen === "checkpoint-session") content = renderCheckpointSession();
  else if (state.tab === "learn") content = renderHome();
  else if (state.tab === "review") content = renderReviewPage();
  else content = renderProgressPage();

  root.innerHTML = (isActivityScreen() ? "" : renderTopbar()) + content;
  bind();
}

function renderHome() {
  return `
    <section class="hero">
      <div class="eyebrow">Tu aventura de vocabulario</div>
      <h1>Aprende alemán con tu mundo 🇩🇪</h1>
      <p>Fotografía tus objetos, aprende su nombre y deja que FLSHD decida cuándo debes volver a verlos.</p>
    </section>

    <section class="summary-grid" aria-label="Resumen">
      <button class="summary-card" id="continueLearning">
        <span class="icon">🚀</span>
        <span><strong>${learnedCount()} / ${WORDS.length}</strong><small>Palabras dominadas</small></span>
      </button>
      <button class="summary-card" id="openReview">
        <span class="icon">🧠</span>
        <span><strong>${dueWords().length}</strong><small>Repasos pendientes</small></span>
      </button>
    </section>

    <h2 class="section-title">Tu camino de aprendizaje</h2>
    <p class="section-note">Empieza arriba y avanza hacia abajo. Cada anillo muestra tu progreso real.</p>

    <section class="learning-path" aria-label="Temas">
      ${THEMES.map((theme, index) => {
        const progress = topicProgress(theme.id);
        const status = progress === 100 ? "✓ Completado" : progress > 0 ? "En progreso" : "Por descubrir";
        const statusClass = progress === 100 ? "done" : progress > 0 ? "partial" : "";
        return `
          <button class="topic-node" data-topic="${theme.id}" aria-label="${escapeHTML(theme.name)}, ${progress}%">
            <span class="topic-index">${index + 1}</span>
            <span class="progress-ring" role="progressbar" aria-valuemin="0" aria-valuemax="100"
              aria-valuenow="${progress}" style="--p:${progress};--tone:${theme.tone}">
              <span class="ring-inner" aria-hidden="true">${theme.icon}</span>
            </span>
            <strong>${escapeHTML(theme.name)}</strong>
            <small>${progress}% aprendido</small>
            <span class="topic-state ${statusClass}">${status}</span>
          </button>
        `;
      }).join("")}
    </section>

    <div class="home-note">
      📸 Las imágenes que subes quedan asociadas a cada palabra en este dispositivo.
      ${state.storageAvailable ? "" : "<br><b>Aviso:</b> el navegador no está permitiendo guardar datos de forma permanente."}
    </div>
  `;
}

function renderTopicIntro() {
  const theme = themeById(state.topicId);
  const words = topicWords(theme.id);
  const mastered = words.filter(word => progressFor(word.id).mastered).length;
  const photos = words.filter(word => state.images.has(word.id)).length;

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
      <div class="stage-chip">2 · 🎯 Elegir</div>
      <div class="stage-chip">3 · ✍️ Escribir</div>
    </div>

    <div class="review-card">
      <h2>Cómo funciona</h2>
      <p class="muted small">
        Primero verás cada palabra como una tarjeta. Sube o haz tu propia foto, toca la tarjeta para revelar la palabra
        y desliza a la derecha si la sabías o a la izquierda si no. Después tendrás preguntas de 4 opciones y,
        finalmente, escribirás la palabra viendo la imagen.
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
      <section class="page-head">
        <button class="back-btn" id="backHome">←</button>
        <div><h1>${theme.icon} ${escapeHTML(theme.name)}</h1><p>Tema completado</p></div>
      </section>
      <div class="celebrate">
        <div class="emoji">🏆</div>
        <h2>¡Tema dominado!</h2>
        <p>Estas palabras ya han entrado en tu sistema de repetición. La primera revisión aparecerá dentro de 3 días.</p>
        <button class="btn primary" id="finishTopic">Volver al camino</button>
      </div>
    `;
  }

  const word = sessionWord();
  const count = `${Math.min(session.index + 1, session.queue.length)} / ${session.queue.length}`;

  let body = "";
  if (session.phase === "flashcard") body = renderFlashcard(word);
  if (session.phase === "choice") body = renderChoiceQuestion(word);
  if (session.phase === "typing") body = renderTypingQuestion(word);

  return `
    <section class="page-head">
      <button class="back-btn" id="leaveSession">←</button>
      <div><h1>${theme.icon} ${escapeHTML(theme.name)}</h1><p>Ciclo ${session.cycle} · Aprende las palabras sin errores consecutivos.</p></div>
    </section>
    ${stageMarkup(session.phase)}
    <div class="session-progress"><div style="width:${sessionProgressPercent()}%"></div></div>
    <div class="session-count">${count}</div>
    ${body}
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
      <p class="translation">${escapeHTML(word.spanish)}</p>
    </article>

    <div class="action-row">
      <button class="btn danger" id="didntKnow">← No la sabía</button>
      <button class="btn primary" id="knewIt">Me la sé →</button>
    </div>
  `;
}

function optionCandidates(word) {
  const pool = topicWords(word.themeId).filter(candidate => candidate.id !== word.id);
  const shuffled = [...pool].sort(() => Math.random() - .5).slice(0, 3);
  return [word, ...shuffled].sort(() => Math.random() - .5);
}

function renderChoiceQuestion(word) {
  const session = state.session;
  if (!session.options || session.optionWordId !== word.id) {
    session.options = optionCandidates(word).map(option => option.id);
    session.optionWordId = word.id;
    session.questionKind = session.index % 2 === 0 ? "translation" : "image";
  }

  const options = session.options.map(wordById);
  const photoQuestion = session.questionKind === "image";

  return `
    <section class="question-card">
      <h2>${photoQuestion ? "¿Cómo se llama esto en alemán?" : "¿Cuál es la palabra alemana?"}</h2>
      ${photoQuestion ? imageMarkup(word, "question-photo") : `<div class="prompt">${escapeHTML(word.spanish)}</div>`}
      ${photoQuestion && !state.images.has(word.id) ? '<p class="small muted">Aún no has subido foto: usamos el icono como apoyo.</p>' : ""}
    </section>

    <div class="options-grid">
      ${options.map(option => {
        let cls = "";
        if (session.answered && option.id === word.id) cls = "correct";
        if (session.answered && option.id === session.selected && option.id !== word.id) cls = "wrong";
        return `
          <button class="option ${cls}" data-option="${option.id}" ${session.answered ? "disabled" : ""}>
            ${escapeHTML(option.german)}
          </button>
        `;
      }).join("")}
    </div>

    ${session.feedback ? `<div class="feedback">${session.feedback}</div>
      <div class="action-row"><button class="btn primary" id="continueQuestion">Continuar</button></div>` : ""}
  `;
}

function renderTypingQuestion(word) {
  const session = state.session;

  return `
    <section class="question-card">
      <h2>Escribe la palabra alemana</h2>
      ${imageMarkup(word, "question-photo")}
      <p class="translation">${escapeHTML(word.spanish)}</p>
      <input id="typingAnswer" class="answer-input" type="text" autocomplete="off" autocapitalize="off"
        spellcheck="false" placeholder="Escribe en alemán…" ${session.answered ? "disabled" : ""}>
      <p class="small muted">No distinguimos mayúsculas y minúsculas. Puedes escribir el sustantivo con o sin artículo.</p>
    </section>

    ${session.feedback ? `<div class="feedback">${session.feedback}</div>` : ""}

    <div class="action-row">
      ${session.answered
        ? '<button class="btn primary" id="continueQuestion">Continuar</button>'
        : '<button class="btn primary" id="checkTyping">Comprobar</button>'}
    </div>
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
  const correct = optionId === word.id;
  let p = progressFor(word.id);
  const now = dateOnly();

  session.answered = true;
  session.selected = optionId;

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
    session.feedback = cleanNext === 2
      ? "✅ Correcto. Mantienes una secuencia limpia."
      : "✅ Correcto, pero esta palabra tuvo un fallo antes. La reforzaremos otra vez.";
  } else {
    p = scheduleFailure(p, now);
    session.queue.push(word.id);
    session.feedback = `❌ La respuesta era <b>${escapeHTML(word.article ? word.article + " " : "")}${escapeHTML(word.german)}</b>. Volverá a aparecer.`;
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

  if (correct && p.learningStep === 2) {
    p = scheduleNewlyLearned({
      ...p,
      learningStep: 3,
      bestLearningStep: 3
    }, now);
    state.session.feedback = "✅ Perfecto. Has superado las tres etapas seguidas: palabra aprendida.";
  } else if (correct) {
    p = {
      ...p,
      known: true,
      learningStep: 0,
      lastSeenAt: now,
      lastSuccessAt: now,
      correctCount: (p.correctCount || 0) + 1
    };
    state.session.feedback = "✅ La has escrito bien, pero hubo un fallo previo. Harás otro ciclo corto para consolidarla.";
  } else {
    p = scheduleFailure(p, now);
    state.session.queue.push(word.id);
    state.session.feedback = `❌ Era <b>${escapeHTML(word.article ? word.article + " " : "")}${escapeHTML(word.german)}</b>. Volverá a aparecer.`;
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
  session.selected = null;
  session.options = null;
  session.optionWordId = null;
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
      <div class="celebrate">
        <div class="emoji">🧠✨</div>
        <h2>Repaso terminado</h2>
        <p>Has vaciado la cola de hoy.</p>
        <button class="btn primary" id="finishReview">Volver</button>
      </div>
    `;
  }

  const typed = session.index % 2 === 1;

  let body;
  if (typed) {
    body = `
      <section class="question-card">
        <h2>¿Cómo se llama en alemán?</h2>
        ${imageMarkup(word, "question-photo")}
        <p class="translation">${escapeHTML(word.spanish)}</p>
        <input id="reviewTyping" class="answer-input" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="Escribe la palabra…" ${session.answered ? "disabled" : ""}>
      </section>
      ${session.feedback ? `<div class="feedback">${session.feedback}</div>` : ""}
      <div class="action-row">
        ${session.answered ? '<button class="btn primary" id="continueReview">Continuar</button>' : '<button class="btn primary" id="checkReviewTyping">Comprobar</button>'}
      </div>
    `;
  } else {
    if (!session.options || session.optionWordId !== word.id) {
      session.options = optionCandidates(word).map(item => item.id);
      session.optionWordId = word.id;
    }
    body = `
      <section class="question-card">
        <h2>Elige el nombre correcto</h2>
        ${imageMarkup(word, "question-photo")}
        <p class="translation">${escapeHTML(word.spanish)}</p>
      </section>
      <div class="options-grid">
        ${session.options.map(id => {
          const option = wordById(id);
          let cls = "";
          if (session.answered && option.id === word.id) cls = "correct";
          if (session.answered && option.id === session.selected && option.id !== word.id) cls = "wrong";
          return `<button class="option ${cls}" data-review-option="${id}" ${session.answered ? "disabled" : ""}>${escapeHTML(option.german)}</button>`;
        }).join("")}
      </div>
      ${session.feedback ? `<div class="feedback">${session.feedback}</div><div class="action-row"><button class="btn primary" id="continueReview">Continuar</button></div>` : ""}
    `;
  }

  return `
    <section class="page-head">
      <button class="back-btn" id="leaveReview">←</button>
      <div><h1>🧠 Repaso</h1><p>Los errores de la última semana aumentan la prioridad.</p></div>
    </section>
    <div class="session-progress"><div style="width:${Math.round(session.index / session.queue.length * 100)}%"></div></div>
    <div class="session-count">${session.index + 1} / ${session.queue.length}</div>
    ${body}
  `;
}

async function reviewResult(correct) {
  const word = wordById(state.session.queue[state.session.index]);
  let p = progressFor(word.id);
  const now = dateOnly();

  if (correct) {
    p = scheduleReviewSuccess(p, now);
    state.session.feedback = "✅ Bien. El siguiente repaso queda programado automáticamente.";
  } else {
    p = scheduleFailure(p, now);
    // Repeat again in the same session, after other pending cards.
    state.session.queue.push(word.id);
    state.session.feedback = `❌ Era <b>${escapeHTML(word.article ? word.article + " " : "")}${escapeHTML(word.german)}</b>. La volverás a ver hoy y pronto otra vez.`;
  }

  state.session.answered = true;
  await persist(p);
  render();
}

function continueReview() {
  state.session.index += 1;
  state.session.answered = false;
  state.session.feedback = null;
  state.session.selected = null;
  state.session.options = null;
  state.session.optionWordId = null;
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
  state.tab = tab;
  state.topicId = null;
  state.session = null;
  state.screen = "home";
  render();
}

function bind() {
  document.querySelectorAll("[data-topic]").forEach(button => {
    button.addEventListener("click", () => {
      state.topicId = button.dataset.topic;
      state.screen = "topic";
      render();
    });
  });

  document.querySelector("#continueLearning")?.addEventListener("click", () => {
    const theme = THEMES.find(item => topicProgress(item.id) > 0 && topicProgress(item.id) < 100)
      || THEMES.find(item => topicProgress(item.id) < 100)
      || THEMES[0];
    state.topicId = theme.id;
    state.screen = "topic";
    render();
  });

  document.querySelector("#openReview")?.addEventListener("click", () => navigateTab("review"));
  document.querySelector("#backHome")?.addEventListener("click", () => navigateTab("learn"));
  document.querySelector("#startTopic")?.addEventListener("click", () => startTopic(state.topicId));
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
        resolve(canvas.toDataURL("image/jpeg", .8));
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

async function init() {
  try {
    await seedWords(WORDS);
    const [progress, images] = await Promise.all([getAllProgress(), getAllImages()]);
    state.progress = progress;
    state.images = images;
  } catch (error) {
    state.storageAvailable = false;
    console.warn("FLSHD is running without persistent storage.", error);
  }

  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker unavailable", error));
  }
}

init();
