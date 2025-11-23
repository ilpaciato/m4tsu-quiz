document.addEventListener("DOMContentLoaded", () => {
    
    // --- ELEMENTI ---
    const screens = document.querySelectorAll(".screen");
    const navLinks = document.querySelectorAll(".nav-link");
    
    // Schermate
    const homeScreen = document.getElementById("home-screen");
    const libraryScreen = document.getElementById("library-screen");
    const settingsScreen = document.getElementById("settings-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const reviewScreen = document.getElementById("review-screen");
    const resultsScreen = document.getElementById("results-screen");
    
    // UI Elements
    const quizListContainer = document.getElementById("quiz-list-container");
    const settingsQuizTitle = document.getElementById("settings-quiz-title");
    const settingsForm = document.getElementById("quiz-settings-form");
    
    const questionCounterTitle = document.getElementById("question-counter-title");
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

    // --- STATO DEL GIOCO ---
    let quizLibrary = [];
    let selectedQuizFile = "";
    let allQuestions = [];
    let filteredQuestions = [];
    let currentQuestionIndex = 0;
    
    // Settings
    let currentMode = "pratica"; // 'pratica' o 'sfida'
    let timerInterval = null;
    let timeLeft = 30;

    // userAnswers[i] = { status: 'selected'|'confirmed'|'skipped'|'timeout', selectedAnswer: '...', isCorrect: true/false }
    let userAnswers = [];
    // Stato match game
    let matchState = { selectedConcept: null, selectedDescription: null, matchedPairs: 0 };

    // --- NAVIGAZIONE ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.add("hidden"));
        document.getElementById(screenId).classList.remove("hidden");
        
        navLinks.forEach(link => {
            if(link.dataset.screen === screenId) link.classList.add("active");
            else link.classList.remove("active");
        });
    }

    document.querySelectorAll("[data-screen]").forEach(btn => {
        btn.addEventListener("click", () => showScreen(btn.dataset.screen));
    });

    // --- CARICAMENTO LIBRERIA ---
    async function loadLibrary() {
        try {
            const res = await fetch("./data/quiz-list.json");
            if(!res.ok) throw new Error("Err");
            quizLibrary = await res.json();
            
            quizListContainer.innerHTML = "";
            quizLibrary.forEach(quiz => {
                const div = document.createElement("div");
                div.className = "quiz-list-item";
                div.innerHTML = `<h3>${quiz.title}</h3><p>${quiz.description}</p>`;
                div.addEventListener("click", () => {
                    selectedQuizFile = quiz.file;
                    settingsQuizTitle.textContent = quiz.title;
                    showScreen("settings-screen");
                });
                quizListContainer.appendChild(div);
            });
        } catch(e) { console.error(e); }
    }

    // --- AVVIO QUIZ CON SETTINGS ---
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        
        const numQ = formData.get("numQuestions");
        const typeQ = formData.get("questionType");
        currentMode = formData.get("quizMode");

        try {
            const res = await fetch(`./data/${selectedQuizFile}`);
            const data = await res.json();
            let allQ = data.questions;
            
            // 1. Filtra per Tipologia
            if (typeQ !== "all") {
                allQ = allQ.filter(q => q.type === typeQ);
            }

            if (allQ.length === 0) {
                alert("Nessuna domanda trovata per questa tipologia!");
                return;
            }

            // 2. Mescola e Taglia numero
            allQ.sort(() => Math.random() - 0.5);
            if(numQ !== "all") allQ = allQ.slice(0, parseInt(numQ));
            
            filteredQuestions = allQ;
            
            // Init Stato
            currentQuestionIndex = 0;
            userAnswers = filteredQuestions.map(() => ({ status: 'unanswered', selectedAnswer: null, isCorrect: false }));
            
            setupProgressBar();
            loadQuestion(0);
            showScreen("quiz-screen");
        } catch(err) { console.error(err); }
    });

    // --- GESTIONE DOMANDA ---
    function loadQuestion(index) {
        stopTimer();
        const q = filteredQuestions[index];
        const state = userAnswers[index];
        
        // Reset UI Match
        matchState = { selectedConcept: null, selectedDescription: null, matchedPairs: 0 };

        // UI Text
        questionCounterTitle.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question || q.title; // Fallback per match title
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}">` : "";
        questionBody.innerHTML = "";
        explanationBox.classList.add("hidden");
        
        // Timer Display
        if(currentMode === "sfida" && state.status !== 'confirmed') {
            timerDisplay.classList.remove("hidden");
            startTimer();
        } else {
            timerDisplay.classList.add("hidden");
        }
        
        // Gestione Bottoni Navigazione
        if (state.status === 'confirmed' || state.status === 'timeout') {
            confirmBtn.classList.add("hidden");
            skipBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            
            if (index === filteredQuestions.length - 1) {
                nextBtn.classList.add("hidden");
                finishEarlyBtn.classList.remove("hidden");
            }
            // Mostra spiegazione
            if (q.explanation) {
                explanationText.textContent = q.explanation;
                explanationBox.classList.remove("hidden");
            }
        } else {
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = (state.selectedAnswer === null && q.type !== 'match'); // Match ha logica diversa
            skipBtn.classList.remove("hidden");
            nextBtn.classList.add("hidden");
            finishEarlyBtn.classList.add("hidden");
        }

        // Render in base al tipo
        if(q.type === 'multiple-choice') renderMultipleChoice(q, state);
        else if(q.type === 'match') renderMatch(q, state);
        
        updateProgressBar();
    }

    // --- RENDER SCELTA MULTIPLA ---
    function renderMultipleChoice(q, state) {
        questionBody.className = "multiple-choice";
        q.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            
            if (state.status === 'confirmed' || state.status === 'timeout') {
                btn.disabled = true;
                if (opt === state.selectedAnswer) {
                    btn.classList.add(state.isCorrect ? "correct" : "wrong");
                }
                if (opt === q.answer && !state.isCorrect) btn.classList.add("correct");
            } else {
                if (opt === state.selectedAnswer) btn.classList.add("selected");
                btn.onclick = () => selectOption(opt);
            }
            questionBody.appendChild(btn);
        });
    }

    // --- RENDER MATCH ---
    function renderMatch(q, state) {
        questionBody.className = "match";
        confirmBtn.classList.add("hidden"); // Match si conferma da solo progressivamente

        const col1 = document.createElement("div"); col1.className = "match-column";
        const col2 = document.createElement("div"); col2.className = "match-column";

        // Se confermato, mostra tutto verde/rosso statico? 
        // Per semplicità, nel match confermato mostriamo solo "completato"
        // Qui implementiamo la logica interattiva
        
        q.concepts.forEach(c => col1.appendChild(createMatchItem(c, 'concept', q)));
        // Mischia descrizioni se non ancora risposto definitivamente
        let descList = q.descriptions;
        if(state.status === 'unanswered') {
             // Semplificazione: le mischiamo solo visualmente qui
             descList = [...q.descriptions].sort(() => Math.random() - 0.5);
        }
        descList.forEach(d => col2.appendChild(createMatchItem(d, 'description', q)));

        questionBody.appendChild(col1);
        questionBody.appendChild(col2);
    }

    function createMatchItem(text, type, q) {
        const div = document.createElement("div");
        div.className = "match-item";
        div.textContent = text;
        div.dataset.type = type;
        
        div.onclick = () => handleMatchClick(div, text, type, q);
        return div;
    }

    function handleMatchClick(el, text, type, q) {
        if(el.classList.contains("matched")) return;
        
        // Deseleziona altri dello stesso tipo
        document.querySelectorAll(`.match-item[data-type="${type}"]`).forEach(i => i.classList.remove("selected"));
        el.classList.add("selected");
        
        if(type === 'concept') matchState.selectedConcept = el;
        else matchState.selectedDescription = el;

        // Check match
        if(matchState.selectedConcept && matchState.selectedDescription) {
            const concept = matchState.selectedConcept.textContent;
            const desc = matchState.selectedDescription.textContent;
            
            if(q.answers[concept] === desc) {
                // Corretto
                matchState.selectedConcept.classList.add("matched");
                matchState.selectedDescription.classList.add("matched");
                matchState.selectedConcept.classList.remove("selected");
                matchState.selectedDescription.classList.remove("selected");
                matchState.matchedPairs++;
                
                // Reset selezione
                matchState.selectedConcept = null;
                matchState.selectedDescription = null;

                // Check se finito
                if(matchState.matchedPairs === Object.keys(q.answers).length) {
                    stopTimer();
                    const state = userAnswers[currentQuestionIndex];
                    state.status = 'confirmed';
                    state.isCorrect = true;
                    state.selectedAnswer = "Match Completato"; // Placeholder
                    loadQuestion(currentQuestionIndex);
                }
            } else {
                // Sbagliato
                matchState.selectedConcept.classList.add("wrong");
                matchState.selectedDescription.classList.add("wrong");
                setTimeout(() => {
                    document.querySelectorAll(".match-item").forEach(i => i.classList.remove("wrong", "selected"));
                    matchState.selectedConcept = null;
                    matchState.selectedDescription = null;
                }, 800);
            }
        }
    }


    // --- AZIONI ---
    function selectOption(ans) {
        const state = userAnswers[currentQuestionIndex];
        state.selectedAnswer = ans;
        state.status = 'selected';
        
        document.querySelectorAll(".option-btn").forEach(btn => {
            if(btn.textContent === ans) btn.classList.add("selected");
            else btn.classList.remove("selected");
        });
        
        confirmBtn.disabled = false;
    }

    confirmBtn.onclick = () => {
        const state = userAnswers[currentQuestionIndex];
        const q = filteredQuestions[currentQuestionIndex];
        
        state.status = 'confirmed';
        state.isCorrect = (state.selectedAnswer === q.answer);
        loadQuestion(currentQuestionIndex);
    };

    skipBtn.onclick = () => {
        const state = userAnswers[currentQuestionIndex];
        state.status = 'skipped';
        state.selectedAnswer = null;
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
        timerDisplay.textContent = `${timeLeft}s`;
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `${timeLeft}s`;
            if (timeLeft <= 0) {
                stopTimer();
                handleTimeout();
            }
        }, 1000);
    }
    
    function stopTimer() {
        if(timerInterval) clearInterval(timerInterval);
    }
    
    function handleTimeout() {
        const state = userAnswers[currentQuestionIndex];
        state.status = 'timeout';
        state.isCorrect = false;
        state.selectedAnswer = "Tempo Scaduto";
        loadQuestion(currentQuestionIndex);
    }

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
            if (idx === currentQuestionIndex) dot.classList.add("current");
            
            const s = userAnswers[idx];
            if (s.status === 'confirmed' || s.status === 'timeout') dot.classList.add("answered");
            if (s.status === 'skipped') dot.classList.add("skipped");
        });
    }

    // --- REVIEW SCREEN ---
    function showReview() {
        showScreen("review-screen");
        const list = document.getElementById("unanswered-list");
        list.innerHTML = "";
        
        let pending = 0;
        userAnswers.forEach((ans, i) => {
            if (ans.status !== 'confirmed' && ans.status !== 'timeout') {
                pending++;
                const item = document.createElement("div");
                item.className = "result-item"; 
                item.innerHTML = `Domanda ${i+1}: ${ans.status === 'skipped' ? 'Saltata' : 'Non confermata'}`;
                item.onclick = () => {
                    currentQuestionIndex = i;
                    loadQuestion(i);
                    showScreen("quiz-screen");
                };
                list.appendChild(item);
            }
        });
        
        if(pending === 0) list.innerHTML = "<p style='text-align:center'>Tutte le domande completate!</p>";
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
            div.className = `result-item ${ans.isCorrect ? 'correct' : (ans.status==='skipped' ? 'skipped' : 'wrong')}`;
            div.innerHTML = `
                <p><strong>${i+1}. ${q.question || "Abbinamento"}</strong></p>
                <div class="result-explanation hidden">
                    <p>Tua risposta: ${ans.selectedAnswer || "Nessuna"}</p>
                    <p>Corretta: ${q.answer || "Vedi abbinamenti"}</p>
                    <hr>
                    <p>${q.explanation || ""}</p>
                </div>
            `;
            // Clicca per espandere
            div.onclick = () => {
                div.querySelector(".result-explanation").classList.toggle("hidden");
            };
            container.appendChild(div);
        });
    };

    // Init
    loadLibrary();
    showScreen("home-screen");
});