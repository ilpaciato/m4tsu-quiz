document.addEventListener("DOMContentLoaded", () => {
    
    // --- ELEMENTI DOM ---
    const screens = document.querySelectorAll(".screen");
    const navLinks = document.querySelectorAll(".nav-link");
    
    // Schermate
    const homeScreen = document.getElementById("home-screen");
    const libraryScreen = document.getElementById("library-screen");
    const settingsScreen = document.getElementById("settings-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const reviewScreen = document.getElementById("review-screen");
    const resultsScreen = document.getElementById("results-screen");
    
    // Elementi Quiz
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
    const prevBtn = document.getElementById("prev-btn");
    const finishEarlyBtn = document.getElementById("finish-early-btn");
    const backToQuizBtn = document.getElementById("back-to-quiz-btn");
    const submitAllBtn = document.getElementById("submit-all-btn");
    const restartBtn = document.getElementById("restart-btn");

    // --- STATO ---
    let quizLibrary = [];
    let selectedQuizFile = "";
    let allQuestions = [];
    let filteredQuestions = [];
    let currentQuestionIndex = 0;
    
    // STRUTTURA USER ANSWERS:
    // { 
    //   status: 'unanswered' | 'selected' | 'confirmed' | 'skipped', 
    //   selectedAnswer: string | null, // Quello che l'utente ha cliccato ma non confermato
    //   confirmedAnswer: string | null, // Quello che è stato validato
    //   isCorrect: boolean
    // }
    let userAnswers = [];
    
    let timerInterval = null;
    let quizMode = 'pratica';
    let timeLeft = 0;

    // --- NAVIGAZIONE ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.add("hidden"));
        document.getElementById(screenId).classList.remove("hidden");
        // Aggiorna menu
        navLinks.forEach(link => {
            if(link.dataset.screen === screenId) link.classList.add("active");
            else link.classList.remove("active");
        });
    }

    document.querySelectorAll("[data-screen]").forEach(btn => {
        btn.addEventListener("click", (e) => showScreen(btn.dataset.screen));
    });

    // --- LIBRERIA ---
    async function loadLibrary() {
        try {
            const res = await fetch("./data/quiz-list.json"); // Assicurati che questo file esista
            if(!res.ok) throw new Error("No Library");
            quizLibrary = await res.json();
            
            quizListContainer.innerHTML = "";
            quizLibrary.forEach(quiz => {
                const div = document.createElement("div");
                div.className = "quiz-list-item";
                div.innerHTML = `<h3>${quiz.title}</h3><p>${quiz.description}</p>`;
                div.addEventListener("click", () => openSettings(quiz));
                quizListContainer.appendChild(div);
            });
        } catch(e) {
            quizListContainer.innerHTML = "<p>Errore caricamento libreria. Controlla i file.</p>";
        }
    }

    function openSettings(quiz) {
        selectedQuizFile = quiz.file;
        settingsQuizTitle.textContent = quiz.title;
        showScreen("settings-screen");
    }

    // --- AVVIO QUIZ ---
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        
        // Carica dati
        try {
            const res = await fetch(`./data/${selectedQuizFile}`);
            const data = await res.json();
            allQuestions = data.questions;
        } catch(err) { alert("Errore file quiz"); return; }

        // Filtri
        const numQ = formData.get("numQuestions");
        const shuffle = formData.get("shuffle");
        quizMode = formData.get("quizMode");

        let qs = [...allQuestions];
        if(shuffle) qs.sort(() => Math.random() - 0.5);
        if(numQ !== "all") qs = qs.slice(0, parseInt(numQ));
        
        filteredQuestions = qs;
        
        // Init Stato
        currentQuestionIndex = 0;
        userAnswers = filteredQuestions.map(() => ({
            status: 'unanswered',
            selectedAnswer: null,
            confirmedAnswer: null,
            isCorrect: false
        }));

        startQuiz();
    });

    function startQuiz() {
        showScreen("quiz-screen");
        loadQuestion(currentQuestionIndex);
    }

    // --- GESTIONE DOMANDE ---
    function loadQuestion(index) {
        stopTimer();
        
        const q = filteredQuestions[index];
        const state = userAnswers[index];

        // UI Reset
        questionCounter.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question;
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}">` : "";
        questionBody.innerHTML = "";
        explanationBox.classList.add("hidden");
        
        // Bottoni navigazione
        prevBtn.disabled = index === 0;
        
        // Gestione visibilità bottoni azione
        if (state.status === 'confirmed') {
            // Se già risposto
            confirmBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            if (index === filteredQuestions.length - 1) {
                nextBtn.classList.add("hidden");
                finishEarlyBtn.classList.remove("hidden");
            }
            // Mostra spiegazione subito
            explanationText.textContent = q.explanation;
            explanationBox.classList.remove("hidden");
        } else {
            // Se non ancora risposto
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = state.selectedAnswer === null; // Disabilita se nulla selezionato
            nextBtn.classList.add("hidden");
            finishEarlyBtn.classList.add("hidden");
        }

        // Render Opzioni
        if (q.type === "multiple-choice") renderMultipleChoice(q, state);
        else if (q.type === "match") renderMatch(q, state);

        // Timer
        if (quizMode === 'sfida' && state.status !== 'confirmed') {
            startTimer(30);
        }
    }

    // --- RENDER SCELTA MULTIPLA ---
    function renderMultipleChoice(question, state) {
        questionBody.className = "multiple-choice";
        
        question.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            
            // Ripristina stato visivo
            if (state.status === 'confirmed') {
                btn.disabled = true;
                if (opt === state.confirmedAnswer) {
                    btn.classList.add(state.isCorrect ? "correct" : "wrong");
                }
                if (opt === question.answer && !state.isCorrect) {
                    btn.classList.add("correct"); // Mostra quella giusta se hai sbagliato
                }
            } else {
                // Modalità selezione
                if (state.selectedAnswer === opt) {
                    btn.classList.add("selected");
                }
                btn.onclick = () => selectOption(opt);
            }
            
            questionBody.appendChild(btn);
        });
    }

    // --- LOGICA SELEZIONE E CONFERMA ---
    
    // 1. Utente clicca opzione (NON CONFERMA ANCORA)
    function selectOption(answer) {
        const state = userAnswers[currentQuestionIndex];
        
        // Aggiorna stato temp
        state.selectedAnswer = answer;
        state.status = 'selected';
        
        // Aggiorna UI
        confirmBtn.disabled = false;
        
        // Ridisegna classi visuali (rimuovi selected dagli altri)
        const buttons = document.querySelectorAll(".option-btn");
        buttons.forEach(btn => {
            if (btn.textContent === answer) btn.classList.add("selected");
            else btn.classList.remove("selected");
        });
    }

    // 2. Utente clicca CONFERMA
    confirmBtn.addEventListener("click", () => {
        submitAnswer();
    });

    function submitAnswer() {
        stopTimer();
        const state = userAnswers[currentQuestionIndex];
        const question = filteredQuestions[currentQuestionIndex];

        if (!state.selectedAnswer && state.status !== 'skipped') return;

        // Salva definitivo
        state.confirmedAnswer = state.selectedAnswer;
        state.status = 'confirmed';
        state.isCorrect = (state.confirmedAnswer === question.answer);
        
        // Aggiorna UI
        loadQuestion(currentQuestionIndex); // Ricarica per mostrare colori e spiegazione
    }

    // --- NAVIGAZIONE NEXT/PREV ---
    nextBtn.addEventListener("click", () => {
        if (currentQuestionIndex < filteredQuestions.length - 1) {
            currentQuestionIndex++;
            loadQuestion(currentQuestionIndex);
        } else {
            showReviewScreen();
        }
    });

    prevBtn.addEventListener("click", () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadQuestion(currentQuestionIndex);
        }
    });
    
    finishEarlyBtn.addEventListener("click", showReviewScreen);

    // --- REVIEW SCREEN (Punto 5) ---
    function showReviewScreen() {
        showScreen("review-screen");
        const list = document.getElementById("unanswered-list");
        list.innerHTML = "";
        
        let pendingCount = 0;

        userAnswers.forEach((ans, idx) => {
            if (ans.status !== 'confirmed') {
                pendingCount++;
                const div = document.createElement("div");
                div.className = "review-item";
                div.innerHTML = `
                    <span>Domanda ${idx + 1}</span>
                    <span class="review-status skipped">Non risposta</span>
                `;
                // Cliccando ti porta lì
                div.onclick = () => {
                    currentQuestionIndex = idx;
                    showScreen("quiz-screen");
                    loadQuestion(idx);
                };
                list.appendChild(div);
            }
        });

        if (pendingCount === 0) {
            list.innerHTML = "<p style='padding:1rem; text-align:center; color:green'>Tutte le domande completate!</p>";
        }
    }

    backToQuizBtn.addEventListener("click", () => {
        showScreen("quiz-screen");
    });

    submitAllBtn.addEventListener("click", showResults);

    // --- RISULTATI ---
    function showResults() {
        showScreen("results-screen");
        let score = 0;
        userAnswers.forEach(a => { if(a.isCorrect) score++; });
        
        document.getElementById("score-text").textContent = `${score} / ${filteredQuestions.length}`;
        
        const container = document.getElementById("results-review-container");
        container.innerHTML = "";
        
        filteredQuestions.forEach((q, i) => {
            const ans = userAnswers[i];
            const div = document.createElement("div");
            let cssClass = ans.isCorrect ? "correct" : (ans.status === 'confirmed' ? "wrong" : "skipped");
            div.className = `result-item ${cssClass}`;
            
            let userTxt = ans.confirmedAnswer || "Nessuna";
            div.innerHTML = `
                <p><strong>${i+1}.</strong> ${q.question}</p>
                <div style="font-size:0.9rem; margin-top:5px;">
                    Tua: ${userTxt} <br>
                    ${!ans.isCorrect ? `Corretta: <strong>${q.answer}</strong>` : ""}
                </div>
            `;
            container.appendChild(div);
        });
    }

    // --- TIMER ---
    function startTimer(seconds) {
        timeLeft = seconds;
        timerDisplay.classList.remove("hidden");
        timerDisplay.textContent = timeLeft;
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                stopTimer();
                // Tempo scaduto: segna come sbagliato
                const state = userAnswers[currentQuestionIndex];
                state.selectedAnswer = "Tempo Scaduto";
                state.isCorrect = false; 
                submitAnswer();
            }
        }, 1000);
    }
    
    function stopTimer() {
        clearInterval(timerInterval);
        timerDisplay.classList.add("hidden");
    }

    // Init
    loadLibrary();
    showScreen("home-screen");
});