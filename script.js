const GAME_DURATION = 75;
const STARTING_LIVES = 3;
const FISH_COUNT = 4;
const MIN_MULTIPLIER = 1;
const MAX_MULTIPLIER = 10;
const BASE_SPEED = 70;
const SPEED_STEP = 9;
const FEEDBACK_DELAY = 900;
const BEST_SCORE_KEY = "rybalka-umnozheniya-best-score";

const gameState = {
  status: "start",
  score: 0,
  bestScore: 0,
  lives: STARTING_LIVES,
  timeLeft: GAME_DURATION,
  currentQuestion: null,
  fish: [],
  boatX: 50,
  animationFrameId: null,
  timerId: null,
  lastFrameTime: 0,
  feedbackTimeoutId: null
};

const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  end: document.getElementById("end-screen")
};

const ui = {
  question: document.getElementById("question-text"),
  score: document.getElementById("score-value"),
  bestScore: document.getElementById("best-score-value"),
  bestScoreStart: document.getElementById("best-score-start"),
  bestScoreEnd: document.getElementById("best-score-end"),
  lives: document.getElementById("lives-value"),
  timer: document.getElementById("timer-value"),
  fishLayer: document.getElementById("fish-layer"),
  boat: document.getElementById("boat"),
  pond: document.getElementById("pond"),
  feedback: document.getElementById("feedback"),
  finalScore: document.getElementById("final-score"),
  finalMessage: document.getElementById("final-message"),
  resultTitle: document.getElementById("result-title"),
  startButton: document.getElementById("start-button"),
  restartButton: document.getElementById("restart-button")
};

function loadBestScore() {
  try {
    const storedValue = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsedValue = Number.parseInt(storedValue ?? "0", 10);
    gameState.bestScore = Number.isFinite(parsedValue) ? parsedValue : 0;
  } catch {
    gameState.bestScore = 0;
  }
}

function saveBestScore() {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(gameState.bestScore));
  } catch {
    // Ignore storage errors so the game keeps working in restrictive browsers.
  }
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("screen-active", key === name);
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  const next = [...array];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function questionGenerator() {
  const left = randomInt(MIN_MULTIPLIER, MAX_MULTIPLIER);
  const right = randomInt(MIN_MULTIPLIER, MAX_MULTIPLIER);

  return {
    left,
    right,
    answer: left * right,
    label: `${left} × ${right}`
  };
}

function generateWrongAnswer(correctAnswer, usedAnswers) {
  let candidate = correctAnswer;

  while (usedAnswers.has(candidate) || candidate <= 0) {
    const drift = randomInt(-10, 10);
    const fallback = correctAnswer + randomInt(1, 12);
    candidate = correctAnswer + drift || fallback;
  }

  return candidate;
}

function spawnFishAnswers(correctAnswer) {
  const answers = [correctAnswer];
  const usedAnswers = new Set(answers);

  while (answers.length < FISH_COUNT) {
    const wrongAnswer = generateWrongAnswer(correctAnswer, usedAnswers);
    answers.push(wrongAnswer);
    usedAnswers.add(wrongAnswer);
  }

  const pondRect = ui.pond.getBoundingClientRect();
  const availableHeight = Math.max(pondRect.height - 250, 180);

  return shuffle(answers).map((value, index) => ({
    id: `${Date.now()}-${index}-${value}`,
    value,
    x: randomInt(10, 72),
    y: 180 + index * (availableHeight / FISH_COUNT),
    speed: BASE_SPEED + gameState.score * SPEED_STEP + randomInt(0, 35),
    direction: index % 2 === 0 ? 1 : -1,
    variant: (index % 4) + 1
  }));
}

function renderStats() {
  ui.question.textContent = gameState.currentQuestion?.label ?? "0 × 0";
  ui.score.textContent = String(gameState.score);
  ui.bestScore.textContent = String(gameState.bestScore);
  ui.bestScoreStart.textContent = String(gameState.bestScore);
  ui.bestScoreEnd.textContent = String(gameState.bestScore);
  ui.lives.textContent = String(gameState.lives);
  ui.timer.textContent = String(gameState.timeLeft);
}

function renderBoat() {
  ui.boat.style.setProperty("--boat-x", `${gameState.boatX}%`);
}

function renderFish() {
  ui.fishLayer.innerHTML = "";

  gameState.fish.forEach((fish) => {
    const fishButton = document.createElement("button");
    fishButton.type = "button";
    fishButton.className = `fish fish-${fish.variant}`;
    fishButton.dataset.id = fish.id;
    fishButton.style.left = `${fish.x}%`;
    fishButton.style.top = `${fish.y}px`;
    fishButton.innerHTML = `<span>${fish.value}</span>`;
    fishButton.setAttribute("aria-label", `Рыбка с числом ${fish.value}`);
    fishButton.addEventListener("pointerdown", () => {
      selectFish(fish.id);
    });
    ui.fishLayer.appendChild(fishButton);
  });
}

function setFeedback(message, type = "") {
  ui.feedback.textContent = message;
  ui.feedback.className = "feedback";

  if (type) {
    ui.feedback.classList.add(type);
  }

  clearTimeout(gameState.feedbackTimeoutId);
  if (gameState.status === "playing" && type) {
    gameState.feedbackTimeoutId = window.setTimeout(() => {
      ui.feedback.textContent = "Лови правильную рыбку!";
      ui.feedback.className = "feedback";
    }, FEEDBACK_DELAY);
  }
}

function nextQuestion() {
  gameState.currentQuestion = questionGenerator();
  gameState.fish = spawnFishAnswers(gameState.currentQuestion.answer);
  renderStats();
  renderFish();
}

function animateHook() {
  ui.boat.classList.remove("boat-catch");
  void ui.boat.offsetWidth;
  ui.boat.classList.add("boat-catch");
}

function removeFishById(fishId) {
  const fishElement = ui.fishLayer.querySelector(`[data-id="${fishId}"]`);

  if (fishElement) {
    fishElement.classList.add("caught");
  }

  gameState.fish = gameState.fish.filter((fish) => fish.id !== fishId);
}

function handleCatch(answer) {
  if (answer === gameState.currentQuestion.answer) {
    gameState.score += 1;
    setFeedback("Верно! Отличный улов!", "success");
    if (gameState.score > gameState.bestScore) {
      gameState.bestScore = gameState.score;
      saveBestScore();
    }
    nextQuestion();
    return;
  }

  gameState.lives -= 1;
  renderStats();

  if (gameState.lives <= 0) {
    setFeedback("Ой! Неправильная рыбка.", "error");
    endGame();
    return;
  }

  setFeedback("Почти! Попробуй другую рыбку.", "error");
}

function updateFishPositions(deltaSeconds) {
  const minX = 2;
  const maxX = 82;

  gameState.fish.forEach((fish) => {
    fish.x += (fish.speed * fish.direction * deltaSeconds) / 10;

    if (fish.x <= minX) {
      fish.x = minX;
      fish.direction = 1;
    } else if (fish.x >= maxX) {
      fish.x = maxX;
      fish.direction = -1;
    }
  });
}

function gameLoop(timestamp) {
  if (gameState.status !== "playing") {
    return;
  }

  if (!gameState.lastFrameTime) {
    gameState.lastFrameTime = timestamp;
  }

  const deltaSeconds = (timestamp - gameState.lastFrameTime) / 1000;
  gameState.lastFrameTime = timestamp;

  updateFishPositions(deltaSeconds);
  renderFish();
  gameState.animationFrameId = window.requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  if (gameState.animationFrameId) {
    window.cancelAnimationFrame(gameState.animationFrameId);
    gameState.animationFrameId = null;
  }

  if (gameState.timerId) {
    window.clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function finishMessage() {
  if (gameState.score >= 12) {
    return {
      title: "Супер-рыбак!",
      text: "Ты очень быстро находишь правильные ответы."
    };
  }

  if (gameState.score >= 7) {
    return {
      title: "Хороший улов!",
      text: "Ещё пара раундов, и таблица умножения будет совсем лёгкой."
    };
  }

  return {
    title: "Начало отличное!",
    text: "Повтори ещё разок, и ответы начнут вспоминаться быстрее."
  };
}

function endGame() {
  gameState.status = "end";
  stopGameLoop();
  clearTimeout(gameState.feedbackTimeoutId);

  const summary = finishMessage();
  ui.finalScore.textContent = String(gameState.score);
  ui.resultTitle.textContent = summary.title;
  ui.finalMessage.textContent = summary.text;
  renderStats();
  showScreen("end");
}

function startTimer() {
  gameState.timerId = window.setInterval(() => {
    gameState.timeLeft -= 1;
    renderStats();

    if (gameState.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function resetState() {
  gameState.status = "playing";
  gameState.score = 0;
  gameState.lives = STARTING_LIVES;
  gameState.timeLeft = GAME_DURATION;
  gameState.currentQuestion = null;
  gameState.fish = [];
  gameState.boatX = 50;
  gameState.lastFrameTime = 0;
}

function startGame() {
  stopGameLoop();
  resetState();
  renderBoat();
  setFeedback("Лови правильную рыбку!");
  nextQuestion();
  renderStats();
  renderFish();
  showScreen("game");
  startTimer();
  gameState.animationFrameId = window.requestAnimationFrame(gameLoop);
}

function moveBoat(direction) {
  if (gameState.status !== "playing") {
    return;
  }

  gameState.boatX = Math.min(92, Math.max(8, gameState.boatX + direction * 4));
  renderBoat();
}

function moveBoatToPointer(event) {
  if (gameState.status !== "playing") {
    return;
  }

  const rect = ui.pond.getBoundingClientRect();
  const nextX = ((event.clientX - rect.left) / rect.width) * 100;
  gameState.boatX = Math.min(92, Math.max(8, nextX));
  renderBoat();
}

function selectFish(fishId) {
  if (gameState.status !== "playing") {
    return;
  }

  const selectedFish = gameState.fish.find((fish) => fish.id === fishId);
  if (!selectedFish) {
    return;
  }

  gameState.boatX = Math.min(92, Math.max(8, selectedFish.x + 4));
  renderBoat();
  animateHook();
  removeFishById(selectedFish.id);
  handleCatch(selectedFish.value);
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    moveBoat(-1);
    return;
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    moveBoat(1);
    return;
  }
}

ui.startButton.addEventListener("click", startGame);
ui.restartButton.addEventListener("click", startGame);
ui.pond.addEventListener("pointermove", moveBoatToPointer);
window.addEventListener("keydown", onKeyDown);

loadBestScore();
renderStats();
renderBoat();
