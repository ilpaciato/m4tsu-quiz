// Aspetta che l'HTML sia stato caricato prima di eseguire lo script
document.addEventListener("DOMContentLoaded", () => {

    // Selettori degli elementi principali dell'interfaccia
    const startScreen = document.getElementById("start-screen");
    const quizScreen = document.getElementById("quiz-screen");
    const resultsScreen = document.getElementById("results-screen");
    
    const startBtn = document.getElementById("start-btn");
    const nextBtn = document.getElementById("next-btn");
    const restartBtn = document.getElementById("restart-btn");
    
    const questionHeader = document.getElementById("question-header");
    const questionImageContainer = document.getElementById("question-image-container");
    const questionBody = document.getElementById("question-body");
    const scoreText = document.getElementById("score-text");

    // Variabili di stato del quiz
    let quizData = null;
    let currentQuestionIndex = 0;
    let score = 0;

    // --- 1. FUNZIONE DI AVVIO ---
    
    // Carica il file JSON con le domande
    async function loadQuizData() {
        try {
            const response = await fetch("./data/quizzes.json");
            if (!response.ok) {
                throw new Error("Errore nel caricamento del file quizzes.json");
            }
            quizData = await response.json();
            // Per ora carichiamo solo il primo quiz nel file JSON
            // In futuro potresti far scegliere all'utente quale quiz fare
            quizData = quizData.quizzes[0];
        } catch (error) {
            console.error(error);
            questionHeader.innerHTML = "<h2>Impossibile caricare il quiz. Riprova.</h2>";
        }
    }

    // Avvia il quiz
    function startQuiz() {
        if (!quizData) {
            console.error("Dati del quiz non ancora caricati");
            return;
        }
        startScreen.classList.add("hidden");
        resultsScreen.classList.add("hidden");
        quizScreen.classList.remove("hidden");
        
        currentQuestionIndex = 0;
        score = 0;
        showQuestion();
    }

    // --- 2. LOGICA DI VISUALIZZAZIONE DELLE DOMANDE ---

    function showQuestion() {
        // Pulisce la schermata precedente
        resetQuestionScreen();
        
        // Controlla se il quiz è finito
        if (currentQuestionIndex >= quizData.questions.length) {
            showResults();
            return;
        }

        const question = quizData.questions[currentQuestionIndex];
        
        // Mostra l'intestazione (es. "Domanda 1 di 10")
        questionHeader.innerHTML = `<h2>${question.title || `Domanda ${currentQuestionIndex + 1} di ${quizData.questions.length}`}</h2>`;

        // Mostra l'immagine se presente
        if (question.image) {
            questionImageContainer.innerHTML = `<img src="${question.image}" alt="Immagine della domanda">`;
        }

        // Decide quale tipo di domanda mostrare
        if (question.type === "multiple-choice") {
            displayMultipleChoice(question);
        } else if (question.type === "match") {
            displayMatch(question);
        }
    }

    // Mostra una domanda a risposta multipla
    function displayMultipleChoice(question) {
        questionBody.className = "multiple-choice";
        questionBody.innerHTML = `<h3>${question.question}</h3>`;
        
        const optionsGrid = document.createElement("div");
        optionsGrid.className = "options-grid";

        // Crea un bottone per ogni opzione
        question.options.forEach(option => {
            const button = document.createElement("button");
            button.className = "option-btn";
            button.textContent = option;
            button.addEventListener("click", () => handleAnswer(option, question.answer, button));
            optionsGrid.appendChild(button);
        });
        
        questionBody.appendChild(optionsGrid);
    }

    // Mostra una domanda di tipo "Match"
    function displayMatch(question) {
        questionBody.className = "match";
        
        const conceptsCol = document.createElement("div");
        conceptsCol.className = "match-column";
        conceptsCol.innerHTML = "<h4>Concetti</h4>";
        
        const descriptionsCol = document.createElement("div");
        descriptionsCol.className = "match-column";
        descriptionsCol.innerHTML = "<h4>Descrizioni</h4>";

        // Per rendere le cose più interessanti, mescoliamo le descrizioni
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

    // Pulisce la schermata per la prossima domanda
    function resetQuestionScreen() {
        questionHeader.innerHTML = "";
        questionImageContainer.innerHTML = "";
        questionBody.innerHTML = "";
        questionBody.className = "";
        nextBtn.classList.add("hidden");
    }

    // --- 3. LOGICA DI GESTIONE DELLE RISPOSTE ---

    // Gestione risposta multipla
    function handleAnswer(selectedOption, correctAnswer, selectedButton) {
        const buttons = document.querySelectorAll(".option-btn");
        
        // Disabilita tutti i bottoni dopo la risposta
        buttons.forEach(btn => btn.disabled = true);

        if (selectedOption === correctAnswer) {
            score++;
            selectedButton.classList.add("correct");
        } else {
            selectedButton.classList.add("wrong");
            // Evidenzia anche la risposta corretta
            buttons.forEach(btn => {
                if (btn.textContent === correctAnswer) {
                    btn.classList.add("correct");
                }
            });
        }
        
        nextBtn.classList.remove("hidden");
    }

    // Variabili per la logica "Match"
    let selectedConcept = null;
    let selectedDescription = null;
    let matchedPairs = 0;

    // Crea un singolo item cliccabile per il "Match"
    function createMatchItem(text, type, question) {
        const item = document.createElement("div");
        item.className = "match-item";
        item.textContent = text;
        item.dataset.type = type; // 'concept' o 'description'
        
        item.addEventListener("click", () => {
            handleMatchClick(item, type, question);
        });
        
        return item;
    }

    // Gestione click per il "Match"
    function handleMatchClick(item, type, question) {
        if (item.classList.contains("matched")) return; // Già abbinato

        // Rimuovi la selezione precedente dello stesso tipo
        const currentSelected = document.querySelector(`.match-item[data-type="${type}"].selected`);
        if (currentSelected) {
            currentSelected.classList.remove("selected");
        }
        
        // Se clicco di nuovo sullo stesso, lo deseleziono
        if (currentSelected === item) {
            if (type === 'concept') selectedConcept = null;
            if (type === 'description') selectedDescription = null;
            return;
        }

        // Seleziona il nuovo item
        item.classList.add("selected");
        if (type === 'concept') {
            selectedConcept = item;
        } else {
            selectedDescription = item;
        }

        // Se ho selezionato entrambi, controllo la corrispondenza
        if (selectedConcept && selectedDescription) {
            checkMatch(question.answers);
        }
    }

    // Controlla se il concept e la description selezionati sono corretti
    function checkMatch(answers) {
        const conceptText = selectedConcept.textContent;
        const descriptionText = selectedDescription.textContent;

        if (answers[conceptText] === descriptionText) {
            // Corretto!
            selectedConcept.classList.add("matched");
            selectedDescription.classList.add("matched");
            selectedConcept.classList.remove("selected");
            selectedDescription.classList.remove("selected");
            
            selectedConcept = null;
            selectedDescription = null;
            
            matchedPairs++;
            
            // Controlla se tutte le coppie sono state abbinate
            const totalPairs = Object.keys(answers).length;
            if (matchedPairs === totalPairs) {
                score++; // +1 punto per aver completato il match
                matchedPairs = 0; // Resetta per la prossima domanda match
                nextBtn.classList.remove("hidden");
            }
        } else {
            // Sbagliato!
            selectedConcept.classList.add("wrong");
            selectedDescription.classList.add("wrong");
            
            // Rimuovi lo stato "sbagliato" dopo un secondo
            setTimeout(() => {
                selectedConcept.classList.remove("wrong", "selected");
                selectedDescription.classList.remove("wrong", "selected");
                selectedConcept = null;
                selectedDescription = null;
            }, 800);
        }
    }


    // --- 4. RISULTATI E NAVIGAZIONE ---

    // Mostra la prossima domanda
    function nextQuestion() {
        currentQuestionIndex++;
        showQuestion();
    }

    // Mostra la schermata dei risultati finali
    function showResults() {
        quizScreen.classList.add("hidden");
        resultsScreen.classList.remove("hidden");
        scoreText.textContent = `${score} / ${quizData.questions.length}`;
    }

    // --- 5. COLLEGAMENTO DEGLI EVENTI ---
    
    // Inizializza tutto
    (async () => {
        await loadQuizData(); // Aspetta che il JSON sia caricato
        
        // Ora che i dati ci sono, collega gli eventi ai bottoni
        startBtn.addEventListener("click", startQuiz);
        nextBtn.addEventListener("click", nextQuestion);
        restartBtn.addEventListener("click", () => {
            // Ricarica la pagina per un restart semplice
            // Oppure potresti richiamare startQuiz()
            location.reload(); 
        });
    })();

});