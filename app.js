// app.js – lógica principal del quiz
// Usa ES6 modules (type="module" en index.html)

const QUESTIONS_URL = "questions.json";
const LOCAL_STORAGE_STATE_KEY = "quizAppState";
const LOCAL_STORAGE_CUSTOM_KEY = "quizCustomQuestions";

let allQuestions = [];
let state = {
  currentIndex: 0,
  answers: [], // {questionId, selected, correct}
  streak: 0,
  maxStreak: 0,
  topicErrors: {},
  questionOrder: [],
  showingBatchScore: false
};

function initializeQuestionOrder() {
  if (!state.questionOrder || state.questionOrder.length !== allQuestions.length) {
    let order = Array.from({length: allQuestions.length}, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    state.questionOrder = order;
    saveState();
  }
}

/*** UTILIDADES DE STATE ***/
function loadState() {
  const saved = localStorage.getItem(LOCAL_STORAGE_STATE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.warn("Estado corrupto, se reinicia");
    }
  }
}
function saveState() {
  localStorage.setItem(LOCAL_STORAGE_STATE_KEY, JSON.stringify(state));
}
function resetState() {
  localStorage.removeItem(LOCAL_STORAGE_STATE_KEY);
  state = {
    currentIndex: 0,
    answers: [],
    streak: 0,
    maxStreak: 0,
    topicErrors: {},
    questionOrder: [],
    showingBatchScore: false
  };
  initializeQuestionOrder();
  saveState();
}
/*** CARGA DE PREGUNTAS ***/
async function loadQuestions() {
  const base = window.quizQuestions || [];
  // Cargar preguntas personalizadas guardadas en localStorage
  const custom = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CUSTOM_KEY) || "[]");
  allQuestions = base.concat(custom);
  initializeQuestionOrder();
}
/*** RENDERIZADO DE INTERFAZ ***/
function renderHeader() {
  const badge = document.getElementById("streak-badge");
  badge.textContent = `Racha: ${state.streak}`;
}

function renderQuestion() {
  const appDiv = document.getElementById("app");
  appDiv.innerHTML = ""; // limpiar
  if (state.currentIndex >= allQuestions.length) {
    // No hay más preguntas
    const endMsg = document.createElement("div");
    endMsg.className = "question-card";
    endMsg.innerHTML = `<h2>¡Has terminado el cuestionario!</h2>`;
    appDiv.appendChild(endMsg);
    showAnalytics();
    return;
  }

  if (state.showingBatchScore) {
    renderBatchScore();
    return;
  }

  const qIndex = state.questionOrder[state.currentIndex];
  const q = allQuestions[qIndex];
  const card = document.createElement("div");
  card.className = "question-card";
  const qTitle = document.createElement("h2");
  qTitle.textContent = `${state.currentIndex + 1}. ${q.question}`;
  card.appendChild(qTitle);

  const optionsGrid = document.createElement("div");
  optionsGrid.className = "options-grid";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.dataset.idx = idx;
    btn.addEventListener("click", () => handleOptionSelect(idx, btn, q));
    optionsGrid.appendChild(btn);
  });
  card.appendChild(optionsGrid);

  const nextBtn = document.createElement("button");
  nextBtn.className = "next-btn";
  nextBtn.textContent = "Siguiente";
  nextBtn.disabled = true;
  nextBtn.addEventListener("click", () => {
    state.currentIndex++;
    if (state.currentIndex > 0 && state.currentIndex % 12 === 0 && state.currentIndex < allQuestions.length) {
      state.showingBatchScore = true;
    }
    saveState();
    renderQuestion();
    renderHeader();
  });
  card.appendChild(nextBtn);
  appDiv.appendChild(card);
}

function handleOptionSelect(selectedIdx, btnElement, question) {
  // Desactivar todas las opciones
  const allBtns = btnElement.parentElement.querySelectorAll(".option-btn");
  allBtns.forEach(b => b.disabled = true);
  const correctIdx = question.correctIndex;
  const isCorrect = selectedIdx === correctIdx;
  // Marcar estilos
  if (isCorrect) {
    btnElement.classList.add("correct");
    state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
  } else {
    btnElement.classList.add("wrong");
    // marcar la correcta también
    const correctBtn = Array.from(allBtns).find(b => Number(b.dataset.idx) === correctIdx);
    if (correctBtn) correctBtn.classList.add("correct");
    // reset streak
    state.streak = 0;
    // contabilizar error por tema
    const topic = question.topic || "General";
    state.topicErrors[topic] = (state.topicErrors[topic] || 0) + 1;
  }
  // Guardar respuesta
  state.answers.push({
    questionId: state.currentIndex,
    selected: selectedIdx,
    correct: isCorrect
  });
  // habilitar botón siguiente
  const nextBtn = btnElement.parentElement.parentElement.querySelector(".next-btn");
  nextBtn.disabled = false;
  saveState();
  renderHeader();
}

function renderBatchScore() {
  const appDiv = document.getElementById("app");
  appDiv.innerHTML = "";
  
  const card = document.createElement("div");
  card.className = "question-card";
  card.innerHTML = `<h2>Resumen de esta ronda</h2>`;
  
  // Calculate score for the last batch (up to 12)
  const batchSize = Math.min(12, state.currentIndex);
  const lastAnswers = state.answers.slice(-batchSize);
  const correct = lastAnswers.filter(a => a.correct).length;
  const wrong = lastAnswers.length - correct;
  
  const stats = document.createElement("div");
  stats.innerHTML = `<p>Has respondido ${batchSize} preguntas.</p>
                     <p><strong>Correctas:</strong> ${correct} ✅</p>
                     <p><strong>Incorrectas:</strong> ${wrong} ❌</p>`;
  stats.style.fontSize = "1.2rem";
  stats.style.margin = "1rem 0";
  card.appendChild(stats);
  
  const continueBtn = document.createElement("button");
  continueBtn.className = "next-btn";
  continueBtn.textContent = "Continuar";
  continueBtn.addEventListener("click", () => {
    state.showingBatchScore = false;
    saveState();
    renderQuestion();
  });
  
  card.appendChild(continueBtn);
  appDiv.appendChild(card);
}

/*** ANALÍTICA ***/
function showAnalytics() {
  const analytics = document.getElementById("analytics");
  analytics.classList.remove("hidden");
  document.getElementById("total-answered").textContent = state.answers.length;
  const correctCount = state.answers.filter(a => a.correct).length;
  const wrongCount = state.answers.length - correctCount;
  document.getElementById("total-correct").textContent = correctCount;
  document.getElementById("total-wrong").textContent = wrongCount;
  document.getElementById("max-streak").textContent = state.maxStreak;
  // Dibujar gráfico de errores por tema
  const ctx = document.getElementById("topicChart").getContext("2d");
  const topics = Object.keys(state.topicErrors);
  const data = topics.map(t => state.topicErrors[t]);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: topics,
      datasets: [{
        label: "Errores por tema",
        data: data,
        backgroundColor: "rgba(255,59,48,0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

/*** REINICIAR ***/
function setupReset() {
  const btn = document.getElementById("reset-btn");
  btn.addEventListener("click", () => {
    if (confirm("¿Estás seguro de reiniciar todo el progreso?")) {
      resetState();
      renderHeader();
      renderQuestion();
      document.getElementById("analytics").classList.add("hidden");
    }
  });
}

/*** PESTAÑA DE AGREGAR PREGUNTAS ***/
function createAddQuestionTab() {
  // Insertar botón en el header
  const header = document.querySelector(".app-header");
  const addBtn = document.createElement("button");
  addBtn.textContent = "Agregar Pregunta";
  addBtn.className = "reset-btn"; // reutilizamos estilo rojo
  addBtn.style.marginLeft = "1rem";
  header.appendChild(addBtn);

  // Modal sencillo
  const modal = document.createElement("div");
  modal.id = "add-question-modal";
  modal.style.display = "none";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";

  const formContainer = document.createElement("div");
  formContainer.style.background = "var(--card-bg)";
  formContainer.style.padding = "1.5rem";
  formContainer.style.borderRadius = "var(--radius)";
  formContainer.style.maxWidth = "500px";
  formContainer.style.boxShadow = "var(--card-shadow)";

  formContainer.innerHTML = `
    <h2>Agregar nueva pregunta</h2>
    <label>Enunciado:<br><input type="text" id="new-question" style="width:100%" required></label><br><br>
    <label>Opción 1:<br><input type="text" id="opt1" style="width:100%" required></label><br><br>
    <label>Opción 2:<br><input type="text" id="opt2" style="width:100%" required></label><br><br>
    <label>Opción 3:<br><input type="text" id="opt3" style="width:100%" required></label><br><br>
    <label>Índice correcto (0‑2):<br><input type="number" id="correct-index" min="0" max="2" required></label><br><br>
    <label>Tema:<br><input type="text" id="topic" style="width:100%" placeholder="General"></label><br><br>
    <button id="save-question" class="next-btn">Guardar</button>
    <button id="cancel-question" class="reset-btn" style="margin-left:0.5rem;">Cancelar</button>
  `;
  modal.appendChild(formContainer);
  document.body.appendChild(modal);

  addBtn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  document.getElementById("cancel-question").addEventListener("click", () => {
    modal.style.display = "none";
  });

  document.getElementById("save-question").addEventListener("click", () => {
    const question = document.getElementById("new-question").value.trim();
    const opt1 = document.getElementById("opt1").value.trim();
    const opt2 = document.getElementById("opt2").value.trim();
    const opt3 = document.getElementById("opt3").value.trim();
    const correctIdx = Number(document.getElementById("correct-index").value);
    const topic = document.getElementById("topic").value.trim() || "General";
    if (!question || !opt1 || !opt2 || !opt3 || isNaN(correctIdx) || correctIdx < 0 || correctIdx > 2) {
      alert("Por favor completa todos los campos correctamente.");
      return;
    }
    const newQ = {
      question,
      options: [opt1, opt2, opt3],
      correctIndex: correctIdx,
      topic
    };
    // Guardar en localStorage
    const custom = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CUSTOM_KEY) || "[]");
    custom.push(newQ);
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_KEY, JSON.stringify(custom));
    // Recargar preguntas en memoria
    allQuestions.push(newQ);
    alert("Pregunta guardada. Puedes continuar con el quiz.");
    modal.style.display = "none";
  });
}

/*** BOTÓN TERMINAR TEMPRANO ***/
function createEndEarlyButton() {
  const header = document.querySelector(".app-header");
  const endBtn = document.createElement("button");
  endBtn.textContent = "Terminar Test";
  endBtn.className = "reset-btn";
  endBtn.style.marginLeft = "0.5rem";
  
  endBtn.addEventListener("click", () => {
    if (confirm("¿Seguro que quieres terminar ahora y ver tu puntaje global?")) {
      state.currentIndex = allQuestions.length;
      state.showingBatchScore = false;
      saveState();
      renderQuestion();
      document.getElementById("analytics").classList.remove("hidden");
    }
  });
  header.appendChild(endBtn);
}

/*** INICIALIZACIÓN ***/
async function init() {
  loadState();
  await loadQuestions();
  renderHeader();
  renderQuestion();
  setupReset();
  createAddQuestionTab();
  createEndEarlyButton();
}

init();
