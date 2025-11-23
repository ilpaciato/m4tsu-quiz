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
    
    // Elementi Quiz UI
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
    let filteredQuestions = [];
    let currentQuestionIndex = 0;
    
    // userAnswers[i] = { status: 'selected'|'confirmed'|'skipped', selectedAnswer: '...', isCorrect: true/false }
    let userAnswers = [];

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

    // --- CARICAMENTO DATI ---
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

    // --- AVVIO QUIZ ---
    settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const numQ = formData.get("numQuestions");

        try {
            const res = await fetch(`./data/${selectedQuizFile}`);
            const data = await res.json();
            let allQ = data.questions;
            
            // Mescola e taglia
            allQ.sort(() => Math.random() - 0.5);
            if(numQ !== "all") allQ = allQ.slice(0, parseInt(numQ));
            
            filteredQuestions = allQ;
            
            // Inizializza stato vuoto
            currentQuestionIndex = 0;
            userAnswers = filteredQuestions.map(() => ({ status: 'unanswered', selectedAnswer: null, isCorrect: false }));
            
            setupProgressBar();
            loadQuestion(0);
            showScreen("quiz-screen");
        } catch(err) { console.error(err); }
    });

    // --- GESTIONE DOMANDA ---
    function loadQuestion(index) {
        const q = filteredQuestions[index];
        const state = userAnswers[index];
        
        // UI Text
        questionCounterTitle.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question;
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}">` : "";
        questionBody.innerHTML = "";
        explanationBox.classList.add("hidden");
        
        // Gestione Bottoni
        if (state.status === 'confirmed') {
            confirmBtn.classList.add("hidden");
            skipBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            
            if (index === filteredQuestions.length - 1) {
                nextBtn.classList.add("hidden");
                finishEarlyBtn.classList.remove("hidden");
            }

            // Mostra spiegazione
            explanationText.textContent = q.explanation;
            explanationBox.classList.remove("hidden");
        } else {
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = (state.selectedAnswer === null);
            skipBtn.classList.remove("hidden");
            nextBtn.classList.add("hidden");
            finishEarlyBtn.classList.add("hidden");
        }

        // Render Opzioni
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
            
            if (state.status === 'confirmed') {
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

    // --- AZIONI ---
    function selectOption(ans) {
        const state = userAnswers[currentQuestionIndex];
        state.selectedAnswer = ans;
        state.status = 'selected';
        
        // Ricolora UI
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
        loadQuestion(currentQuestionIndex); // Ricarica per mostrare risultati
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
            dot.className = "progress-dot"; // Reset
            if (idx === currentQuestionIndex) dot.classList.add("current");
            
            const s = userAnswers[idx];
            if (s.status === 'confirmed') dot.classList.add("answered");
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
            if (ans.status !== 'confirmed') {
                pending++;
                const item = document.createElement("div");
                item.className = "quiz-list-item"; // Riutilizziamo stile
                item.style.padding = "0.5rem";
                item.style.marginBottom = "0.5rem";
                item.innerHTML = `Domanda ${i+1}: ${ans.status === 'skipped' ? 'Saltata' : 'Non confermata'}`;
                item.onclick = () => {
                    currentQuestionIndex = i;
                    loadQuestion(i);
                    showScreen("quiz-screen");
                };
                list.appendChild(item);
            }
        });
        
        if(pending === 0) list.innerHTML = "<p>Tutte le domande completate!</p>";
    }

    backToQuizBtn.onclick = () => showScreen("quiz-screen");
    
    submitAllBtn.onclick = () => {
        showScreen("results-screen");
        let score = 0;
        userAnswers.forEach(a => { if(a.isCorrect) score++; });
        document.getElementById("score-text").textContent = `${score} / ${filteredQuestions.length}`;
        
        // Genera riepilogo dettagliato
        const container = document.getElementById("results-review-container");
        container.innerHTML = "";
        filteredQuestions.forEach((q, i) => {
            const ans = userAnswers[i];
            const div = document.createElement("div");
            div.className = "quiz-list-item";
            div.style.marginBottom = "0.5rem";
            div.style.borderColor = ans.isCorrect ? "green" : "red";
            div.innerHTML = `<p><strong>${i+1}.</strong> ${ans.isCorrect ? "Corretta" : "Sbagliata"}</p>`;
            container.appendChild(div);
        });
    };

    // Init
    loadLibrary();
    showScreen("home-screen");
});