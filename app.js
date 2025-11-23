// SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW OK:', reg.scope))
            .catch(err => console.log('SW Fail:', err));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    
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
    
    const confirmBtn = document.getElementById("confirm-btn");
    const nextBtn = document.getElementById("next-btn");
    const skipBtn = document.getElementById("skip-btn");
    const finishEarlyBtn = document.getElementById("finish-early-btn");
    const submitAllBtn = document.getElementById("submit-all-btn");
    const backToQuizBtn = document.getElementById("back-to-quiz-btn");
    const restartBtn = document.getElementById("restart-btn");
    const homeToLibraryBtn = document.getElementById("home-to-library-btn");

    let quizLibrary = [], selectedQuizFile = "", filteredQuestions = [], currentQuestionIndex = 0, userAnswers = [];
    let gameMode = "pratica", timerInterval = null, timeLeft = 30;
    let activeMatches = [], currentSelection = { type: null, element: null };
    const MATCH_COLORS = ['match-color-0', 'match-color-1', 'match-color-2', 'match-color-3', 'match-color-4'];

    function showScreen(screenId) {
        screens.forEach(s => s.classList.add("hidden"));
        document.getElementById(screenId).classList.remove("hidden");
        window.scrollTo(0, 0);
        navLinks.forEach(link => {
            if(link.dataset.screen === screenId) link.classList.add("active");
            else link.classList.remove("active");
        });
    }

    navLinks.forEach(link => link.addEventListener("click", (e) => { e.preventDefault(); showScreen(link.dataset.screen); }));
    homeToLibraryBtn.addEventListener("click", () => showScreen("library-screen"));

    async function loadLibrary() {
        try {
            const res = await fetch("./data/quiz-list.json");
            if(!res.ok) throw new Error("Error");
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
            userAnswers = filteredQuestions.map(() => ({ status: 'unanswered', selectedAnswer: null, isCorrect: false, matchPairs: [] }));
            
            setupProgressBar();
            loadQuestion(0);
            showScreen("quiz-screen");
        } catch(err) { console.error(err); }
    });

    function loadQuestion(index) {
        stopTimer();
        const q = filteredQuestions[index];
        const state = userAnswers[index];
        
        activeMatches = [];
        currentSelection = { type: null, element: null };

        questionCounter.textContent = `Domanda ${index + 1} di ${filteredQuestions.length}`;
        questionText.textContent = q.question || q.title;
        questionImageContainer.innerHTML = q.image ? `<img src="${q.image}">` : "";
        questionBody.innerHTML = "";
        
        explanationBox.classList.add("hidden");
        explanationBox.classList.remove("correct", "wrong");
        
        if(gameMode === "sfida" && state.status !== 'confirmed') {
            timerDisplay.classList.remove("hidden");
            startTimer();
        } else {
            timerDisplay.classList.add("hidden");
        }

        const isAnswered = (state.status === 'confirmed' || state.status === 'timeout');
        
        if (isAnswered) {
            confirmBtn.classList.add("hidden");
            skipBtn.classList.add("hidden");
            nextBtn.classList.remove("hidden");
            if (index === filteredQuestions.length - 1) nextBtn.classList.add("hidden");
            
            let showExpl = false;
            if (q.type === 'match') {
                let html = `<p>${q.explanation || ""}</p><ul class="correct-pair-list">`;
                Object.keys(q.answers).forEach((key, idx) => {
                    html += `<li><span class="correction-badge">${idx + 1}</span> ${key} ➜ ${q.answers[key]}</li>`;
                });
                html += "</ul>";
                explanationText.innerHTML = html;
                showExpl = true;
            } else if (q.explanation) {
                explanationText.textContent = q.explanation;
                showExpl = true;
            }

            if (showExpl) {
                explanationBox.classList.remove("hidden");
                explanationBox.classList.add(state.isCorrect ? "correct" : "wrong");
            }

        } else {
            confirmBtn.classList.remove("hidden");
            confirmBtn.disabled = true; 
            skipBtn.classList.remove("hidden");
            nextBtn.classList.add("hidden");
        }

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
                if (opt === state.selectedAnswer) btn.classList.add(state.isCorrect ? "correct" : "wrong");
                if (opt === q.answer && !state.isCorrect) btn.classList.add("correct");
            } else {
                if (opt === state.selectedAnswer) btn.classList.add("selected");
                btn.onclick = () => selectOptionMC(opt);
            }
            questionBody.appendChild(btn);
        });
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

    function renderMatch(q, state) {
        questionBody.className = "match";
        const col1 = document.createElement("div"); col1.className = "match-column";
        const col2 = document.createElement("div"); col2.className = "match-column";

        let descList = q.descriptions;
        if(state.status === 'unanswered') {
             descList = [...q.descriptions].sort(() => Math.random() - 0.5);
        }

        q.concepts.forEach(c => col1.appendChild(createMatchItem(c, 'concept')));
        descList.forEach(d => col2.appendChild(createMatchItem(d, 'description')));

        questionBody.appendChild(col1);
        questionBody.appendChild(col2);
        
        if (state.status === 'confirmed' || state.status === 'timeout') {
            state.matchPairs.forEach(pair => {
                const cEl = Array.from(col1.children).find(el => el.textContent === pair.c);
                const dEl = Array.from(col2.children).find(el => el.textContent === pair.d);
                if(cEl && dEl) {
                    cEl.classList.add(pair.isCorrect ? "matched" : "wrong");
                    dEl.classList.add(pair.isCorrect ? "matched" : "wrong");
                    cEl.style.pointerEvents = "none";
                    dEl.style.pointerEvents = "none";
                }
            });

            const concepts = q.concepts; 
            concepts.forEach((conceptText, idx) => {
                const correctDesc = q.answers[conceptText];
                const badgeNum = idx + 1; 
                const cEl = Array.from(col1.children).find(el => el.firstChild.textContent.trim() === conceptText);
                const dEl = Array.from(col2.children).find(el => el.firstChild.textContent.trim() === correctDesc);
                if (cEl) addBadgeToElement(cEl, badgeNum);
                if (dEl) addBadgeToElement(dEl, badgeNum);
            });
        }
    }

    function addBadgeToElement(el, num) {
        if (el.querySelector(".correction-badge")) return;
        const badge = document.createElement("span");
        badge.className = "correction-badge";
        badge.textContent = num;
        el.appendChild(badge);
    }

    function createMatchItem(text, type) {
        const div = document.createElement("div");
        div.className = "match-item";
        const span = document.createElement("span");
        span.textContent = text;
        div.appendChild(span);
        div.dataset.type = type;
        div.onclick = () => handleMatchSelection(div);
        return div;
    }

    function handleMatchSelection(el) {
        const existingMatchIndex = activeMatches.findIndex(m => m.conceptEl === el || m.descEl === el);
        if (existingMatchIndex !== -1) {
            const match = activeMatches[existingMatchIndex];
            match.conceptEl.classList.remove(match.colorClass);
            match.descEl.classList.remove(match.colorClass);
            activeMatches.splice(existingMatchIndex, 1);
            updateMatchConfirmState();
            return;
        }

        if (currentSelection.element === el) {
            el.classList.remove("selected");
            currentSelection = { type: null, element: null };
            return;
        }

        if (currentSelection.element) {
            if (currentSelection.type === el.dataset.type) {
                currentSelection.element.classList.remove("selected");
                el.classList.add("selected");
                currentSelection.element = el;
            } else {
                const conceptEl = currentSelection.type === 'concept' ? currentSelection.element : el;
                const descEl = currentSelection.type === 'description' ? currentSelection.element : el;
                const usedColors = activeMatches.map(m => m.colorClass);
                const availableColor = MATCH_COLORS.find(c => !usedColors.includes(c)) || MATCH_COLORS[0];

                activeMatches.push({ conceptEl, descEl, colorClass: availableColor });
                conceptEl.classList.remove("selected");
                descEl.classList.remove("selected");
                conceptEl.classList.add(availableColor);
                descEl.classList.add(availableColor);
                currentSelection = { type: null, element: null };
                updateMatchConfirmState();
            }
        } else {
            el.classList.add("selected");
            currentSelection = { type: el.dataset.type, element: el };
        }
    }

    function updateMatchConfirmState() {
        const totalConcepts = document.querySelectorAll('.match-item[data-type="concept"]').length;
        confirmBtn.disabled = (activeMatches.length !== totalConcepts);
    }

    confirmBtn.onclick = () => {
        const state = userAnswers[currentQuestionIndex];
        const q = filteredQuestions[currentQuestionIndex];
        state.status = 'confirmed';

        if (q.type === 'multiple-choice') {
            state.isCorrect = (state.selectedAnswer === q.answer);
        } else if (q.type === 'match') {
            let allCorrect = true;
            let savedPairs = [];
            activeMatches.forEach(m => {
                const cText = m.conceptEl.firstChild.textContent; 
                const dText = m.descEl.firstChild.textContent;
                const isPairCorrect = (q.answers[cText] === dText);
                if (!isPairCorrect) allCorrect = false;
                savedPairs.push({ c: cText, d: dText, isCorrect: isPairCorrect, colorClass: m.colorClass });
            });
            state.isCorrect = allCorrect;
            state.selectedAnswer = allCorrect ? "Tutto corretto" : "Errori presenti";
            state.matchPairs = savedPairs; 
        }
        loadQuestion(currentQuestionIndex);
    };

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

    function startTimer() {
        timeLeft = 30;
        timerDisplay.querySelector("span").textContent = `${timeLeft}s`;
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.querySelector("span").textContent = `${timeLeft}s`;
            if (timeLeft <= 0) {
                stopTimer();
                userAnswers[currentQuestionIndex].status = 'timeout';
                userAnswers[currentQuestionIndex].selectedAnswer = "Tempo Scaduto";
                loadQuestion(currentQuestionIndex);
            }
        }, 1000);
    }
    function stopTimer() { if(timerInterval) clearInterval(timerInterval); }

    function setupProgressBar() {
        progressBar.innerHTML = "";
        filteredQuestions.forEach((_, idx) => {
            const dot = document.createElement("div");
            dot.className = "progress-dot";
            dot.onclick = () => { currentQuestionIndex = idx; loadQuestion(idx); };
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
                div.onclick = () => { currentQuestionIndex = i; loadQuestion(i); showScreen("quiz-screen"); };
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
                    <p style="margin:5px 0 0 0; font-size:0.9rem; color:#666">Risultato: <strong>${ans.isCorrect ? "Corretto" : "Sbagliato"}</strong></p>
                    <div class="result-explanation hidden" style="margin-top:10px; background:#f9f9f9; padding:10px; font-size:0.9rem;">${q.explanation || "Nessuna spiegazione."}</div>
                </div>`;
            div.onclick = () => div.querySelector(".result-explanation").classList.toggle("hidden");
            container.appendChild(div);
        });
    };

    restartBtn.onclick = () => { userAnswers = []; showScreen("library-screen"); };
    loadLibrary(); showScreen("home-screen");
});