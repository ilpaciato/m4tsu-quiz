document.addEventListener("DOMContentLoaded", () => {
    
    // --- SELETTORI DOM ---
    const screens = document.querySelectorAll(".screen");
    const navLinks = document.querySelectorAll(".nav-link");
    const quizContainer = document.getElementById("quiz-container");
    
    // Schermate
    const homeScreen = document.getElementById("home-screen");
    const libraryScreen = document.getElementById("library-screen");
    const settingsScreen = document.getElementById("settings-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const resultsScreen = document.getElementById("results-screen");
    
    // Contenitori Dinamici
    const quizListContainer = document.getElementById("quiz-list-container");
    const settingsQuizTitle = document.getElementById("settings-quiz-title");
    const settingsForm = document.getElementById("quiz-settings-form");
    const questionHeader = document.getElementById("question-header");
    const questionImageContainer = document.getElementById("question-image-container");
    const questionBody = document.getElementById("question-body");
    const explanationBox = document.getElementById("explanation-box");
    const explanationText = document.getElementById("explanation-text");
    const progressBar = document.getElementById("progress-bar");
    const scoreText = document.getElementById("score-text");
    const resultsReviewContainer = document.getElementById("results-review-container");
    const timerDisplay = document.getElementById("timer-display"); // NUOVO
    
    // Bottoni
    const homeToLibraryBtn = document.getElementById("home-to-library-btn");
    const startQuizBtn = document.getElementById("start-quiz-btn");
    const skipBtn = document.getElementById("skip-btn");
    const nextBtn = document.getElementById("next-btn");
    const restartBtn = document.getElementById("restart-btn");

    // --- VARIABILI DI STATO GLOBALI ---
    let quizLibrary = []; 
    let selectedQuizFile = ""; 
    let allQuestions = []; 
    let filteredQuestions = []; 
    let currentQuestionIndex = 0;
    let score = 0;
    let userAnswers = []; 
    let matchState = { 
        selectedConcept: null,
        selectedDescription: null,
        matchedPairs: 0
    };
    
    // Variabili Timer (NUOVE)
    let timerInterval = null;
    let quizMode = 'pratica';
    let timeLeft = 0;

    // --- 1. FUNZIONI DI NAVIGAZIONE SCHERMATE ---

    function showScreen(screenId) {
        screens.forEach(screen => {
            screen.classList.add("hidden");
        });
        document.getElementById(screenId).classList.remove("hidden");
        
        navLinks.forEach(link => {
            if (link.dataset.screen === screenId) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }

    function setupNavigation() {
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                showScreen(link.dataset.screen);
            });
        });

        homeToLibraryBtn.addEventListener("click", () => showScreen("library-screen"));
        restartBtn.addEventListener("click", () => showScreen(restartBtn.dataset.screen));
        
        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            startQuiz();
        });
        
        nextBtn.addEventListener("click", nextQuestion);
        skipBtn.addEventListener("click", skipQuestion);
    }

    // --- 2. SCHERMATA LIBRERIA QUIZ ---

    async function loadQuizLibrary() {
        try {
            const response = await fetch("./data/quiz-list.json");
            if (!response.ok) throw new Error("Errore nel caricamento della libreria quiz.");
            quizLibrary = await response.json();
            
            quizListContainer.innerHTML = ""; 
            
            quizLibrary.forEach(quiz => {
                const quizCard = document.createElement("div");
                quizCard.className = "quiz-list-item";
                quizCard.innerHTML = `
                    <h3>${quiz.title}</h3>
                    <p>${quiz.description}</p>
                `;
                quizCard.addEventListener("click", () => selectQuiz(quiz));
                quizListContainer.appendChild(quizCard);
            });
            
        } catch (error) {
            console.error(error);
            quizListContainer.innerHTML = "<p>Impossibile caricare i quiz. Riprova più tardi.</p>";
        }
    }

    function selectQuiz(quiz) {
        selectedQuizFile = quiz.file;
        settingsQuizTitle.textContent = quiz.title; 
        settingsForm.reset(); 
        showScreen("settings-screen");
    }

    // --- 3. LOGICA DI AVVIO DEL QUIZ ---

    async function startQuiz() {
        // 1. Raccogli le impostazioni
        const formData = new FormData(settingsForm);
        const settings = {
            numQuestions: formData.get("numQuestions"),
            questionType: formData.get("questionType"),
            quizMode: formData.get("quizMode") // NUOVO
        };
        quizMode = settings.quizMode; // Salva la modalità globalmente

        // 2. Carica le domande
        try {
            const response = await fetch(`./data/${selectedQuizFile}`);
            if (!response.ok) throw new Error(`Errore nel caricamento del file ${selectedQuizFile}`);
            const quizData = await response.json();
            allQuestions = quizData.questions;
        } catch (error) {
            console.error(error);
            return;
        }
        
        // 3. Filtra le domande
        let tempQuestions = [...allQuestions];

        if (settings.questionType !== "all") {
            tempQuestions = tempQuestions.filter(q => q.type === settings.questionType);
        }
        
        tempQuestions.sort(() => Math.random() - 0.5);
        
        if (settings.numQuestions !== "all") {
            filteredQuestions = tempQuestions.slice(0, Number(settings.numQuestions));
        } else {
            filteredQuestions = tempQuestions;
        }
        
        if (filteredQuestions.length === 0) {
            alert("Nessuna domanda trovata con queste impostazioni. Prova a cambiarle.");
            return;
        }

        // 4. Resetta stato e avvia
        currentQuestionIndex = 0;
        score = 0;
        userAnswers = new Array(filteredQuestions.length).fill(null);
        stopTimer(); // Assicura che ogni timer sia pulito
        
        buildProgressBar();
        showQuestion();
        showScreen("quiz-screen");
    }

    // --- 4. SCHERMATA QUIZ IN CORSO ---

    function showQuestion() {
        resetQuestionScreen();
        
        const question = filteredQuestions[currentQuestionIndex];
        
        questionHeader.innerHTML = `<h2>${question.title || `Domanda ${currentQuestionIndex + 1} di ${filteredQuestions.length}`}</h2>`;

        if (question.image) {
            questionImageContainer.innerHTML = `<img src="${question.image}" alt="Immagine della domanda">`;
        }

        if (question.type === "multiple-choice") {
            displayMultipleChoice(question);
        } else if (question.type === "match") {
            displayMatch(question);
        }
        
        updateProgressBar();
        
        // AVVIA IL TIMER SE IN MODALITÀ SFIDA
        if (quizMode === 'sfida') {
            startTimer(30); // 30 secondi per domanda
        }
    }
    
    function resetQuestionScreen() {
        questionHeader.innerHTML = "";
        questionImageContainer.innerHTML = "";
        questionBody.innerHTML = "";
        questionBody.className = "";
        explanationBox.classList.add("hidden");
        nextBtn.classList.add("hidden");
        skipBtn.classList.remove("hidden");
        stopTimer(); // Ferma il timer quando si resetta
        
        matchState = { selectedConcept: null, selectedDescription: null, matchedPairs: 0 };
    }

    function displayMultipleChoice(question) {
        questionBody.className = "multiple-choice";
        questionBody.innerHTML = `<h3>${question.question}</h3>`;
        
        const optionsGrid = document.createElement("div");
        optionsGrid.className = "options-grid";

        question.options.forEach(option => {
            const button = document.createElement("button");
            button.className = "option-btn";
            button.textContent = option;
            button.addEventListener("click", () => handleMultipleChoiceAnswer(option, question.answer, button, question.explanation));
            optionsGrid.appendChild(button);
        });
        
        questionBody.appendChild(optionsGrid);
    }
    
    function displayMatch(question) {
        // ... (codice identico a prima) ...
        questionBody.className = "match";
        
        const conceptsCol = document.createElement("div");
        conceptsCol.className = "match-column";
        conceptsCol.innerHTML = "<h4>Concetti</h4>";
        
        const descriptionsCol = document.createElement("div");
        descriptionsCol.className = "match-column";
        descriptionsCol.innerHTML = "<h4>Descrizioni</h4>";

        const shuffledDescriptions = [...question.descriptions].sort(() => Math.random() - 0.5);

        question.concepts.forEach(concept => {
            const item = createMatchItem(concept, 'concept', question);
            conceptsCol.appendChild(item);
        });

        shuffledDescriptions.forEach(description => {
            const item = createMatchItem(description, 'description', question);
            descriptionsCol.appendChild(item);
        });

        questionBody.appendChild(conceptsCol);
        questionBody.appendChild(descriptionsCol);
    }

    function handleMultipleChoiceAnswer(selectedOption, correctAnswer, selectedButton, explanation) {
        if (quizMode === 'sfida') stopTimer(); // Ferma il timer
        
        const buttons = document.querySelectorAll(".option-btn");
        buttons.forEach(btn => btn.disabled = true);
        
        skipBtn.classList.add("hidden");
        nextBtn.classList.remove("hidden");
        
        let isCorrect = false;
        if (selectedOption === correctAnswer) {
            score++;
            isCorrect = true;
            selectedButton.classList.add("correct");
        } else {
            selectedButton.classList.add("wrong");
            buttons.forEach(btn => {
                if (btn.textContent === correctAnswer) {
                    btn.classList.add("correct");
                }
            });
        }
        
        userAnswers[currentQuestionIndex] = { status: isCorrect ? 'correct' : 'wrong', answer: selectedOption };
        updateProgressBar();
        showExplanation(explanation);
    }
    
    function createMatchItem(text, type, question) {
        // ... (codice identico a prima) ...
        const item = document.createElement("div");
        item.className = "match-item";
        item.textContent = text;
        item.dataset.type = type;
        
        item.addEventListener("click", () => {
            if (item.classList.contains("matched")) return;

            const currentSelected = document.querySelector(`.match-item[data-type="${type}"].selected`);
            if (currentSelected) currentSelected.classList.remove("selected");
            
            item.classList.add("selected");
            
            if (type === 'concept') matchState.selectedConcept = item;
            if (type === 'description') matchState.selectedDescription = item;

            if (matchState.selectedConcept && matchState.selectedDescription) {
                checkMatch(question.answers, question.explanation);
            }
        });
        return item;
    }
    
    function checkMatch(answers, explanation) {
        // ... (logica di checkMatch identica a prima) ...
        const conceptText = matchState.selectedConcept.textContent;
        const descriptionText = matchState.selectedDescription.textContent;

        if (answers[conceptText] === descriptionText) {
            matchState.selectedConcept.classList.add("matched");
            matchState.selectedDescription.classList.add("matched");
            matchState.matchedPairs++;
            
            const totalPairs = Object.keys(answers).length;
            if (matchState.matchedPairs === totalPairs) {
                if (quizMode === 'sfida') stopTimer(); // Ferma il timer
                score++; 
                userAnswers[currentQuestionIndex] = { status: 'correct' };
                updateProgressBar();
                showExplanation(explanation);
                skipBtn.classList.add("hidden");
                nextBtn.classList.remove("hidden");
            }
        } else {
            matchState.selectedConcept.classList.add("wrong");
            matchState.selectedDescription.classList.add("wrong");
            
            userAnswers[currentQuestionIndex] = { status: 'wrong' }; 
            
            setTimeout(() => {
                matchState.selectedConcept.classList.remove("wrong", "selected");
                matchState.selectedDescription.classList.remove("wrong", "selected");
            }, 800);
        }
        
        matchState.selectedConcept = null;
        matchState.selectedDescription = null;
    }
    
    function showExplanation(explanation) {
        if (explanation) {
            explanationText.textContent = explanation;
            explanationBox.classList.remove("hidden");
        }
    }
    
    function skipQuestion() {
        if (quizMode === 'sfida') stopTimer(); // Ferma il timer
        userAnswers[currentQuestionIndex] = { status: 'skipped' };
        updateProgressBar();
        nextQuestion();
    }
    
    function nextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < filteredQuestions.length) {
            showQuestion();
        } else {
            showResults();
        }
    }

    // --- 5. BARRA DI PROGRESSIONE ---

    function buildProgressBar() {
        // ... (codice identico a prima) ...
        progressBar.innerHTML = "";
        for (let i = 0; i < filteredQuestions.length; i++) {
            const dot = document.createElement("div");
            dot.className = "progress-dot";
            dot.dataset.index = i;
            dot.addEventListener("click", () => jumpToQuestion(i));
            progressBar.appendChild(dot);
        }
    }
    
    function updateProgressBar() {
        // ... (codice identico a prima) ...
        const dots = document.querySelectorAll(".progress-dot");
        dots.forEach((dot, index) => {
            const answer = userAnswers[index];
            dot.className = "progress-dot"; 
            
            if (answer) {
                dot.classList.add(answer.status); 
            }
            
            if (index === currentQuestionIndex) {
                dot.classList.add("current");
            }
        });
    }
    
    function jumpToQuestion(index) {
        currentQuestionIndex = index;
        showQuestion();
    }

    // --- 6. SCHERMATA RISULTATI ---

    function showResults() {
        stopTimer(); // Ferma qualsiasi timer
        showScreen("results-screen");
        scoreText.textContent = `${score} / ${filteredQuestions.length}`;
        
        resultsReviewContainer.innerHTML = ""; 
        
        filteredQuestions.forEach((question, index) => {
            const answer = userAnswers[index];
            if (!answer) return; 

            const item = document.createElement("div");
            item.className = `result-item ${answer.status}`;
            
            let questionText = question.question || question.title;
            let answerText = "";
            
            if (answer.status === 'correct') {
                answerText = `<span>Risposta corretta.</span>`;
            } else if (answer.status === 'wrong') {
                // MODIFICA: Gestisce il "Tempo Scaduto"
                if (answer.answer === 'Tempo scaduto') {
                    answerText = `<span>Tempo scaduto. Risposta corretta: ${question.answer}</span>`;
                } else {
                    answerText = `<span>La tua risposta: ${answer.answer}. Corretta: ${question.answer}</span>`;
                }
            } else {
                answerText = `<span>Domanda saltata.</span>`;
            }

            item.innerHTML = `
                <p>${index + 1}. ${questionText}</p>
                ${answerText}
                <div class="result-explanation hidden">
                    <p>${question.explanation}</p>
                </div>
            `;
            
            item.addEventListener("click", () => {
                item.querySelector(".result-explanation").classList.toggle("hidden");
            });
            
            resultsReviewContainer.appendChild(item);
        });
    }
    
    // --- 7. FUNZIONI TIMER (NUOVE) ---

    /**
     * Avvia il conto alla rovescia per la domanda.
     * @param {number} seconds Numero di secondi
     */
    function startTimer(seconds) {
        stopTimer(); // Pulisce timer precedenti
        timeLeft = seconds;
        timerDisplay.textContent = `Tempo: ${timeLeft}s`;
        timerDisplay.classList.remove("hidden");

        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `Tempo: ${timeLeft}s`;
            if (timeLeft <= 0) {
                handleTimeUp();
            }
        }, 1000);
    }

    /**
     * Ferma il timer corrente.
     */
    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.classList.add("hidden");
    }

    /**
     * Chiamato quando il timer arriva a 0.
     */
    function handleTimeUp() {
        stopTimer();
        
        const question = filteredQuestions[currentQuestionIndex];
        
        // Disabilita opzioni
        document.querySelectorAll(".option-btn, .match-item").forEach(el => el.disabled = true);
        
        // Segna come sbagliato
        userAnswers[currentQuestionIndex] = { status: 'wrong', answer: 'Tempo scaduto' };
        updateProgressBar();
        
        // Mostra spiegazione e "Next"
        showExplanation(question.explanation);
        nextBtn.classList.remove("hidden");
        skipBtn.classList.add("hidden");
    }


    // --- 8. INIZIALIZZAZIONE ---

    /**
     * Funzione di avvio principale.
     */
    function init() {
        setupNavigation();
        loadQuizLibrary();
        showScreen("home-screen");
    }

    init(); // Avvia l'applicazione
});