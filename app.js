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
    
    // Settings
    let gameMode = "pratica";
    let timerInterval = null;
    let timeLeft = 30;
    
    // Match Game
    let matchState = { selectedConcept: null, selectedDescription: null, matchedPairs: 0 };

    // --- NAVIGAZIONE ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.add("hidden"));
        document.getElementById(screenId).classList.remove("hidden");
        
        // Scroll top
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

    // --- CARICAMENTO LIBRERIA ---
    async function loadLibrary() {
        try {
            const res = await fetch("./data/quiz-list.json");
            if(!res.ok) throw new Error("Errore caricamento lista");
            quizLibrary = await res.json();
            
            quizListContainer.innerHTML = "";
            quizLibrary.forEach(quiz => {
                const div = document.createElement("div");
                div.className = "quiz-list-item";
                div.innerHTML = `
                    <h3>${quiz.title}</h3>
                    <p>${quiz.description}</p>
                `;
                div.onclick = () => {
                    selectedQuizFile = quiz.file;
                    settingsQuizTitle.textContent = quiz.title;
                    showScreen("settings-screen");
                };
                quizListContainer.appendChild(div);
            });
        } catch(e) {
            quizListContainer.innerHTML = "<p>Impossibile caricare i quiz. Controlla la connessione o i file.</p>";
        }
    }

    // --- AVVIO QUIZ ---
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
            
            // Filtra per tipo
            if (typeQ !== "all") {
                allQ = allQ.filter(q => q.type === typeQ);
            }

            if (allQ.length === 0) {
                alert("Nessuna domanda trovata per questa tipologia.");
                return;
            }

            // Mischia e Taglia
            allQ.sort(() => Math.random() - 0.5);
            if(numQ !== "all") {
                allQ = allQ.slice(0, parseInt(numQ));
            }
            
            filteredQuestions = allQ;
            
            // Reset Stato
            currentQuestionIndex = 0;
            userAnswers = filteredQuestions.map(() => ({ 
                status: 'unanswered', 
                selectedAnswer: null, 
                isCorrect: false 
            }));
            
            setupProgressBar();
            loadQuestion(0);
            showScreen("quiz-screen");
        } catch(err) { console.error(err); }
    });

    // --- CORE LOGICA DOMANDA ---
    function loadQuestion(index) {
        stopTimer();
        const q = filteredQuestions[index];
        const state = userAnswers[index];
        
        // Reset Match State
        matchState = { selectedConcept: null, selectedDescription: null, matchedPairs: 0 };

        // UI Update
        questionCounter.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question || q.title;
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}" alt="Domanda">` : "";
        questionBody.innerHTML = "";
        explanationBox.classList.add("hidden");
        
        // Timer
        if(gameMode === "sfida" && state.status !== 'confirmed') {
            timerDisplay.classList.remove("hidden");
            startTimer();
        } else {
            timerDisplay.classList.add("hidden");
        }

        // Gestione Bottoni
        const isAnswered = (state.status === 'confirmed' || state.status === 'timeout');
        
        if (isAnswered) {
            confirmBtn.classList.add("hidden");
            skipBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            
            // Se è l'ultima domanda, nascondi Next e mostra Finish (se non già visibile)
            if (index === filteredQuestions.length - 1) {
                nextBtn.classList.add("hidden");
            }
            
            // Mostra spiegazione
            if (q.explanation) {
                explanationText.textContent = q.explanation;
                explanationBox.classList.remove("hidden");
            }
        } else {
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = (state.selectedAnswer === null && q.type !== 'match');
            skipBtn.classList.remove("hidden");
            nextBtn.classList.add("hidden");
        }

        // Render
        if(q.type === 'multiple-choice') renderMultipleChoice(q, state);
        else if(q.type === 'match') renderMatch(q, state);
        
        updateProgressBar();
    }

    function renderMultipleChoice(q, state) {
        questionBody.className = "multiple-choice";
        q.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            
            const isAnswered = (state.status === 'confirmed' || state.status === 'timeout');
            
            if (isAnswered) {
                btn.disabled = true;
                if (opt === state.selectedAnswer) {
                    btn.classList.add(state.isCorrect ? "correct" : "wrong");
                }
                if (opt === q.answer && !state.isCorrect) {
                    btn.classList.add("correct");
                }
            } else {
                if (opt === state.selectedAnswer) btn.classList.add("selected");
                btn.onclick = () => selectOption(opt);
            }
            questionBody.appendChild(btn);
        });
    }

    function renderMatch(q, state) {
        questionBody.className = "match";
        confirmBtn.classList.add("hidden"); // Match si auto-conferma

        const col1 = document.createElement("div"); col1.className = "match-column";
        const col2 = document.createElement("div"); col2.className = "match-column";

        q.concepts.forEach(c => col1.appendChild(createMatchItem(c, 'concept', q)));
        
        // Mischia descrizioni se non ancora finito
        let descList = q.descriptions;
        if(state.status === 'unanswered') {
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

        document.querySelectorAll(`.match-item[data-type="${type}"]`).forEach(i => i.classList.remove("selected"));
        el.classList.add("selected");

        if(type === 'concept') matchState.selectedConcept = el;
        else matchState.selectedDescription = el;

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
                
                matchState.selectedConcept = null;
                matchState.selectedDescription = null;

                // Check vittoria
                if(matchState.matchedPairs === Object.keys(q.answers).length) {
                    stopTimer();
                    const state = userAnswers[currentQuestionIndex];
                    state.status = 'confirmed';
                    state.isCorrect = true;
                    state.selectedAnswer = "Match Completato";
                    loadQuestion(currentQuestionIndex);
                }
            } else {
                // Errore
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

    // --- INTERAZIONI ---
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
        const span = timerDisplay.querySelector("span");
        span.textContent = `${timeLeft}s`;
        
        timerInterval = setInterval(() => {
            timeLeft--;
            span.textContent = `${timeLeft}s`;
            if (timeLeft <= 0) {
                stopTimer();
                userAnswers[currentQuestionIndex].status = 'timeout';
                userAnswers[currentQuestionIndex].isCorrect = false;
                userAnswers[currentQuestionIndex].selectedAnswer = "Tempo Scaduto";
                loadQuestion(currentQuestionIndex);
            }
        }, 1000);
    }
    
    function stopTimer() {
        if(timerInterval) clearInterval(timerInterval);
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
            if(idx === currentQuestionIndex) dot.classList.add("current");
            
            const s = userAnswers[idx];
            if(s.status === 'confirmed' || s.status === 'timeout') dot.classList.add("answered");
            if(s.status === 'skipped') dot.classList.add("skipped");
        });
    }

    // --- REVIEW ---
    function showReview() {
        showScreen("review-screen");
        const list = document.getElementById("unanswered-list");
        list.innerHTML = "";
        
        let pending = 0;
        userAnswers.forEach((ans, i) => {
            if(ans.status !== 'confirmed' && ans.status !== 'timeout') {
                pending++;
                const div = document.createElement("div");
                div.className = "review-item";
                div.innerHTML = `
                    <span>Domanda ${i+1}</span>
                    <span class="review-status alert">In sospeso</span>
                `;
                div.onclick = () => {
                    currentQuestionIndex = i;
                    loadQuestion(i);
                    showScreen("quiz-screen");
                };
                list.appendChild(div);
            }
        });
        
        if(pending === 0) list.innerHTML = "<p style='text-align:center'>Nessuna domanda in sospeso. Puoi terminare!</p>";
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
            // Bordo sinistro colorato
            div.style.borderLeft = `5px solid ${ans.isCorrect ? '#28a745' : '#dc3545'}`;
            
            div.innerHTML = `
                <div style="width:100%">
                    <p style="margin:0; font-weight:700">${i+1}. ${q.question || "Abbinamento"}</p>
                    <p style="margin:5px 0 0 0; font-size:0.9rem; color:#666">
                        Tua risposta: <strong>${ans.selectedAnswer || "Saltata"}</strong>
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
        // Reset totale
        userAnswers = [];
        showScreen("library-screen");
    };

    // Avvio
    loadLibrary();
    showScreen("home-screen");
});