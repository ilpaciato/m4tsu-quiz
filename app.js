document.addEventListener("DOMContentLoaded", () => {
    
    // --- SELETTORI UI ---
    const screens = document.querySelectorAll(".screen");
    const navLinks = document.querySelectorAll(".nav-link");
    
    const quizListContainer = document.getElementById("quiz-list-container");
    const settingsQuizTitle = document.getElementById("settings-quiz-title");
    const settingsForm = document.getElementById("quiz-settings-form");
    
    const questionCounter = document.getElementById("question-counter");
    const questionText = document.getElementById("question-text");
    const questionImageContainer = document.getElementById("question-image-container");
    const questionBody = document.getElementById("question-body");
    const explanationBox = document.getElementById("explanation-box");
    const explanationText = document.getElementById("explanation-text");
    const progressBar = document.getElementById("progress-bar");
    const timerDisplay = document.getElementById("timer-display");
    
    // Bottoni
    const confirmBtn = document.getElementById("confirm-btn");
    const nextBtn = document.getElementById("next-btn");
    const skipBtn = document.getElementById("skip-btn");
    const finishEarlyBtn = document.getElementById("finish-early-btn");
    const submitAllBtn = document.getElementById("submit-all-btn");
    const backToQuizBtn = document.getElementById("back-to-quiz-btn");
    const restartBtn = document.getElementById("restart-btn");
    const homeToLibraryBtn = document.getElementById("home-to-library-btn");

    // --- VARIABILI DI GIOCO ---
    let quizLibrary = [];
    let selectedQuizFile = "";
    let filteredQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    
    let gameMode = "pratica";
    let timerInterval = null;
    let timeLeft = 30;
    
    // Match Game Temp State
    // activeMatches = [{ conceptEl: el, descEl: el, colorClass: 'match-color-0' }]
    let activeMatches = []; 
    let currentSelection = { type: null, element: null }; // Per la selezione in corso (primo click)
    
    const MATCH_COLORS = ['match-color-0', 'match-color-1', 'match-color-2', 'match-color-3', 'match-color-4'];

    // --- NAVIGAZIONE ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.add("hidden"));
        document.getElementById(screenId).classList.remove("hidden");
        window.scrollTo(0, 0);
        navLinks.forEach(link => {
            if(link.dataset.screen === screenId) link.classList.add("active");
            else link.classList.remove("active");
        });
    }

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            showScreen(link.dataset.screen);
        });
    });

    homeToLibraryBtn.addEventListener("click", () => showScreen("library-screen"));

    // --- CARICAMENTO ---
    async function loadLibrary() {
        try {
            const res = await fetch("./data/quiz-list.json");
            if(!res.ok) throw new Error("Errore lista");
            quizLibrary = await res.json();
            
            quizListContainer.innerHTML = "";
            quizLibrary.forEach(quiz => {
                const div = document.createElement("div");
                div.className = "quiz-list-item";
                div.innerHTML = `<h3>${quiz.title}</h3><p>${quiz.description}</p>`;
                div.onclick = () => {
                    selectedQuizFile = quiz.file;
                    settingsQuizTitle.textContent = quiz.title;
                    showScreen("settings-screen");
                };
                quizListContainer.appendChild(div);
            });
        } catch(e) { quizListContainer.innerHTML = "<p>Errore caricamento.</p>"; }
    }

    // --- AVVIO ---
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const numQ = formData.get("numQuestions");
        const typeQ = formData.get("questionType");
        gameMode = formData.get("quizMode");

        try {
            const res = await fetch(`./data/${selectedQuizFile}`);
            const data = await res.json();
            let allQ = data.questions;
            
            if (typeQ !== "all") allQ = allQ.filter(q => q.type === typeQ);
            if (allQ.length === 0) { alert("Nessuna domanda!"); return; }

            allQ.sort(() => Math.random() - 0.5);
            if(numQ !== "all") allQ = allQ.slice(0, parseInt(numQ));
            
            filteredQuestions = allQ;
            currentQuestionIndex = 0;
            userAnswers = filteredQuestions.map(() => ({ status: 'unanswered', selectedAnswer: null, isCorrect: false }));
            
            setupProgressBar();
            loadQuestion(0);
            showScreen("quiz-screen");
        } catch(err) { console.error(err); }
    });

    // --- LOGICA DOMANDA ---
    function loadQuestion(index) {
        stopTimer();
        const q = filteredQuestions[index];
        const state = userAnswers[index];
        
        // Reset Match vars
        activeMatches = [];
        currentSelection = { type: null, element: null };

        // UI
        questionCounter.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question || q.title;
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}">` : "";
        questionBody.innerHTML = "";
        explanationBox.classList.add("hidden");
        
        // Timer
        if(gameMode === "sfida" && state.status !== 'confirmed') {
            timerDisplay.classList.remove("hidden");
            startTimer();
        } else {
            timerDisplay.classList.add("hidden");
        }

        // Bottoni
        const isAnswered = (state.status === 'confirmed' || state.status === 'timeout');
        
        if (isAnswered) {
            confirmBtn.classList.add("hidden");
            skipBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            if (index === filteredQuestions.length - 1) nextBtn.classList.add("hidden");
            if (q.explanation) {
                explanationText.textContent = q.explanation;
                explanationBox.classList.remove("hidden");
            }
        } else {
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = true; // Disabilitato di default finché non seleziona
            skipBtn.classList.remove("hidden");
            nextBtn.classList.add("hidden");
        }

        if(q.type === 'multiple-choice') renderMultipleChoice(q, state);
        else if(q.type === 'match') renderMatch(q, state);
        
        updateProgressBar();
    }

    // --- MULTIPLE CHOICE ---
    function renderMultipleChoice(q, state) {
        questionBody.className = "multiple-choice";
        q.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            
            const isAnswered = (state.status === 'confirmed' || state.status === 'timeout');
            if (isAnswered) {
                btn.disabled = true;
                if (opt === state.selectedAnswer) btn.classList.add(state.isCorrect ? "correct" : "wrong");
                if (opt === q.answer && !state.isCorrect) btn.classList.add("correct");
            } else {
                if (opt === state.selectedAnswer) btn.classList.add("selected");
                btn.onclick = () => selectOptionMC(opt);
            }
            questionBody.appendChild(btn);
        });
        
        // Se c'era già una selezione temporanea, abilita conferma
        if (state.selectedAnswer && state.status === 'unanswered') confirmBtn.disabled = false;
    }

    function selectOptionMC(ans) {
        const state = userAnswers[currentQuestionIndex];
        state.selectedAnswer = ans;
        
        document.querySelectorAll(".option-btn").forEach(btn => {
            if(btn.textContent === ans) btn.classList.add("selected");
            else btn.classList.remove("selected");
        });
        confirmBtn.disabled = false;
    }

    // --- MATCH GAME LOGIC (NUOVA) ---
    function renderMatch(q, state) {
        questionBody.className = "match";
        const col1 = document.createElement("div"); col1.className = "match-column";
        const col2 = document.createElement("div"); col2.className = "match-column";

        // Se non confermato, mischia descrizioni
        let descList = q.descriptions;
        if(state.status === 'unanswered') descList = [...q.descriptions].sort(() => Math.random() - 0.5);

        q.concepts.forEach(c => col1.appendChild(createMatchItem(c, 'concept')));
        descList.forEach(d => col2.appendChild(createMatchItem(d, 'description')));

        questionBody.appendChild(col1);
        questionBody.appendChild(col2);
        
        // Se già confermato, mostra risultati (logica semplificata per visualizzazione)
        if (state.status === 'confirmed' || state.status === 'timeout') {
            // Disabilita e colora (qui servirebbe logica complessa per ricolorare le coppie esatte)
            // Per semplicità post-conferma, mostriamo solo se era tutto giusto o no
            // In una implementazione avanzata salveremmo le coppie esatte fatte dall'utente.
            document.querySelectorAll(".match-item").forEach(el => {
                el.classList.add("matched");
                el.style.pointerEvents = "none";
            });
        }
    }

    function createMatchItem(text, type) {
        const div = document.createElement("div");
        div.className = "match-item";
        div.textContent = text;
        div.dataset.type = type;
        div.onclick = () => handleMatchSelection(div);
        return div;
    }

    function handleMatchSelection(el) {
        // 1. Se clicco su un elemento già accoppiato -> LIBERALO
        const existingMatchIndex = activeMatches.findIndex(m => m.conceptEl === el || m.descEl === el);
        if (existingMatchIndex !== -1) {
            const match = activeMatches[existingMatchIndex];
            // Rimuovi classi colore
            match.conceptEl.classList.remove(match.colorClass);
            match.descEl.classList.remove(match.colorClass);
            // Rimuovi da array
            activeMatches.splice(existingMatchIndex, 1);
            // Aggiorna stato conferma
            updateMatchConfirmState();
            return;
        }

        // 2. Se clicco su elemento libero
        
        // Se è lo stesso elemento appena cliccato -> Deseleziona
        if (currentSelection.element === el) {
            el.classList.remove("selected");
            currentSelection = { type: null, element: null };
            return;
        }

        // Se ho già una selezione attiva
        if (currentSelection.element) {
            // Se clicco sullo stesso tipo (es Concept su Concept) -> Cambio selezione
            if (currentSelection.type === el.dataset.type) {
                currentSelection.element.classList.remove("selected");
                el.classList.add("selected");
                currentSelection.element = el;
            } else {
                // TIPO OPPOSTO -> CREA COPPIA!
                const conceptEl = currentSelection.type === 'concept' ? currentSelection.element : el;
                const descEl = currentSelection.type === 'description' ? currentSelection.element : el;
                
                // Trova primo colore libero
                const usedColors = activeMatches.map(m => m.colorClass);
                const availableColor = MATCH_COLORS.find(c => !usedColors.includes(c)) || MATCH_COLORS[0];

                // Salva coppia
                activeMatches.push({ conceptEl, descEl, colorClass: availableColor });
                
                // Applica stile
                conceptEl.classList.remove("selected");
                descEl.classList.remove("selected");
                conceptEl.classList.add(availableColor);
                descEl.classList.add(availableColor);
                
                // Reset selezione
                currentSelection = { type: null, element: null };
                
                updateMatchConfirmState();
            }
        } else {
            // Prima selezione
            el.classList.add("selected");
            currentSelection = { type: el.dataset.type, element: el };
        }
    }

    function updateMatchConfirmState() {
        // Abilita conferma solo se TUTTI i concetti sono abbinati
        // Conta elementi totali per tipo
        const totalConcepts = document.querySelectorAll('.match-item[data-type="concept"]').length;
        confirmBtn.disabled = (activeMatches.length !== totalConcepts);
    }

    // --- CONFERMA GLOBALE ---
    confirmBtn.onclick = () => {
        const state = userAnswers[currentQuestionIndex];
        const q = filteredQuestions[currentQuestionIndex];
        state.status = 'confirmed';

        if (q.type === 'multiple-choice') {
            state.isCorrect = (state.selectedAnswer === q.answer);
        } else if (q.type === 'match') {
            // Valida Match
            let allCorrect = true;
            activeMatches.forEach(m => {
                const cText = m.conceptEl.textContent;
                const dText = m.descEl.textContent;
                if (q.answers[cText] !== dText) {
                    allCorrect = false;
                    // Feedback visivo immediato sull'errore
                    m.conceptEl.classList.add("wrong");
                    m.descEl.classList.add("wrong");
                } else {
                    m.conceptEl.classList.add("matched"); // Verde
                    m.descEl.classList.add("matched");
                }
            });
            state.isCorrect = allCorrect;
            // Salviamo una stringa rappresentativa
            state.selectedAnswer = allCorrect ? "Tutti corretti" : "Alcuni errori";
        }
        
        loadQuestion(currentQuestionIndex);
    };

    // --- ALTRI BOTTONI ---
    skipBtn.onclick = () => {
        userAnswers[currentQuestionIndex].status = 'skipped';
        goToNext();
    };

    nextBtn.onclick = () => goToNext();

    function goToNext() {
        if (currentQuestionIndex < filteredQuestions.length - 1) {
            currentQuestionIndex++;
            loadQuestion(currentQuestionIndex);
        } else {
            showReview();
        }
    }
    
    finishEarlyBtn.onclick = showReview;

    // --- TIMER ---
    function startTimer() {
        timeLeft = 30;
        timerDisplay.querySelector("span").textContent = `${timeLeft}s`;
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.querySelector("span").textContent = `${timeLeft}s`;
            if (timeLeft <= 0) {
                stopTimer();
                const state = userAnswers[currentQuestionIndex];
                state.status = 'timeout';
                state.selectedAnswer = "Tempo Scaduto";
                loadQuestion(currentQuestionIndex);
            }
        }, 1000);
    }
    
    function stopTimer() { if(timerInterval) clearInterval(timerInterval); }

    // --- PROGRESS BAR ---
    function setupProgressBar() {
        progressBar.innerHTML = "";
        filteredQuestions.forEach((_, idx) => {
            const dot = document.createElement("div");
            dot.className = "progress-dot";
            dot.onclick = () => {
                currentQuestionIndex = idx;
                loadQuestion(idx);
            };
            progressBar.appendChild(dot);
        });
    }
    
    function updateProgressBar() {
        const dots = document.querySelectorAll(".progress-dot");
        dots.forEach((dot, idx) => {
            dot.className = "progress-dot";
            if(idx === currentQuestionIndex) dot.classList.add("current");
            const s = userAnswers[idx];
            if(s.status === 'confirmed' || s.status === 'timeout') dot.classList.add("answered");
            if(s.status === 'skipped') dot.classList.add("skipped");
        });
    }

    // --- REVIEW & RESULTS ---
    function showReview() {
        showScreen("review-screen");
        const list = document.getElementById("unanswered-list");
        list.innerHTML = "";
        
        let pending = 0;
        userAnswers.forEach((ans, i) => {
            if (ans.status !== 'confirmed' && ans.status !== 'timeout') {
                pending++;
                const div = document.createElement("div");
                div.className = "review-item";
                div.innerHTML = `<span>Domanda ${i+1}</span><span class="review-status alert">In sospeso</span>`;
                div.onclick = () => {
                    currentQuestionIndex = i;
                    loadQuestion(i);
                    showScreen("quiz-screen");
                };
                list.appendChild(div);
            }
        });
        if(pending === 0) list.innerHTML = "<p style='text-align:center'>Tutto completato!</p>";
    }

    backToQuizBtn.onclick = () => showScreen("quiz-screen");
    
    submitAllBtn.onclick = () => {
        showScreen("results-screen");
        let score = 0;
        userAnswers.forEach(a => { if(a.isCorrect) score++; });
        document.getElementById("score-text").textContent = `${score} / ${filteredQuestions.length}`;
        
        const container = document.getElementById("results-review-container");
        container.innerHTML = "";
        
        filteredQuestions.forEach((q, i) => {
            const ans = userAnswers[i];
            const div = document.createElement("div");
            div.className = `review-item result-item ${ans.isCorrect ? 'correct' : 'wrong'}`;
            div.style.borderLeft = `5px solid ${ans.isCorrect ? '#28a745' : '#dc3545'}`;
            
            div.innerHTML = `
                <div style="width:100%">
                    <p style="margin:0; font-weight:700">${i+1}. ${q.question || "Match"}</p>
                    <p style="margin:5px 0 0 0; font-size:0.9rem; color:#666">
                        Risultato: <strong>${ans.isCorrect ? "Corretto" : "Sbagliato"}</strong>
                    </p>
                    <div class="result-explanation hidden" style="margin-top:10px; background:#f9f9f9; padding:10px; font-size:0.9rem;">
                        ${q.explanation || "Nessuna spiegazione."}
                    </div>
                </div>
            `;
            div.onclick = () => div.querySelector(".result-explanation").classList.toggle("hidden");
            container.appendChild(div);
        });
    };

    restartBtn.onclick = () => {
        userAnswers = [];
        showScreen("library-screen");
    };

    loadLibrary();
    showScreen("home-screen");
});