const display = document.querySelector("#display");
const operationLabel = document.querySelector("#operationLabel");
const historyPanel = document.querySelector("#historyPanel");
const historyList = document.querySelector("#history");
const toast = document.querySelector("#toast");
const backgroundCanvas = document.querySelector("#backgroundCanvas");
const backgroundContext = backgroundCanvas.getContext("2d");

const operationSymbols = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
};

const displaySymbols = {
  "*": "x",
  "/": "÷",
};

let displayValue = "0";
let expressionValue = "";
let storedValue = null;
let pendingOperation = null;
let waitingForNewNumber = false;
let justCalculated = false;
let usingExpression = false;
let particles = [];
let mouse = { x: 0, y: 0, active: false };

function resizeBackground() {
  const pixelRatio = window.devicePixelRatio || 1;
  backgroundCanvas.width = window.innerWidth * pixelRatio;
  backgroundCanvas.height = window.innerHeight * pixelRatio;
  backgroundCanvas.style.width = `${window.innerWidth}px`;
  backgroundCanvas.style.height = `${window.innerHeight}px`;
  backgroundContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const particleCount = Math.min(110, Math.max(52, Math.floor(window.innerWidth / 13)));
  particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 2.2 + 1,
    glow: Math.random() * 0.42 + 0.22,
  }));
}

function drawBackground() {
  backgroundContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const gradient = backgroundContext.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  gradient.addColorStop(0, "#101010");
  gradient.addColorStop(0.5, "#050505");
  gradient.addColorStop(1, "#2a1603");
  backgroundContext.fillStyle = gradient;
  backgroundContext.fillRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach((particle, index) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x < -20) particle.x = window.innerWidth + 20;
    if (particle.x > window.innerWidth + 20) particle.x = -20;
    if (particle.y < -20) particle.y = window.innerHeight + 20;
    if (particle.y > window.innerHeight + 20) particle.y = -20;

    if (mouse.active) {
      const dx = mouse.x - particle.x;
      const dy = mouse.y - particle.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 190) {
        particle.x -= dx * 0.0028;
        particle.y -= dy * 0.0028;
      }
    }

    backgroundContext.beginPath();
    backgroundContext.fillStyle = `rgba(255, 159, 10, ${particle.glow})`;
    backgroundContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    backgroundContext.fill();

    for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
      const other = particles[otherIndex];
      const distance = Math.hypot(particle.x - other.x, particle.y - other.y);

      if (distance < 96) {
        backgroundContext.strokeStyle = `rgba(255, 255, 255, ${(96 - distance) / 920})`;
        backgroundContext.lineWidth = 1;
        backgroundContext.beginPath();
        backgroundContext.moveTo(particle.x, particle.y);
        backgroundContext.lineTo(other.x, other.y);
        backgroundContext.stroke();
      }
    }
  });

  if (mouse.active) {
    const glow = backgroundContext.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
    glow.addColorStop(0, "rgba(255, 159, 10, 0.2)");
    glow.addColorStop(1, "rgba(255, 159, 10, 0)");
    backgroundContext.fillStyle = glow;
    backgroundContext.fillRect(mouse.x - 220, mouse.y - 220, 440, 440);
  }

  requestAnimationFrame(drawBackground);
}

function formatNumber(value) {
  if (typeof value !== "number") return value;
  if (!Number.isFinite(value)) return String(value);
  return Number.parseFloat(value.toPrecision(12)).toString();
}

function formatDisplayText(value) {
  return String(value).replace(/[*/]/g, (symbol) => displaySymbols[symbol]);
}

function updateDisplay(animationClass = "display-pop") {
  display.textContent = formatDisplayText(displayValue);
  display.classList.remove("display-pop", "number-enter");
  requestAnimationFrame(() => display.classList.add(animationClass));
}

function updateOperationLabel() {
  if (usingExpression && expressionValue) {
    operationLabel.textContent = "Press = to calculate";
  } else if (storedValue !== null && pendingOperation) {
    operationLabel.textContent = formatDisplayText(`${storedValue} ${operationSymbols[pendingOperation]}`);
  } else {
    operationLabel.innerHTML = "&nbsp;";
  }
}

function setActiveOperator() {
  return;
}

function renderHistory(history) {
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rounded-2xl border border-dashed border-white/15 p-3 text-zinc-500";
    empty.textContent = "No calculations yet";
    historyList.appendChild(empty);
    return;
  }

  [...history].reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-row rounded-2xl bg-white/[0.075] px-4 py-3 font-mono";
    row.textContent = item;
    historyList.appendChild(row);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

async function sendOperation(operation, value = null) {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, value }),
  });

  const payload = await response.json();
  renderHistory(payload.state.history);

  if (!payload.ok) {
    showToast(payload.error);
    return null;
  }

  return formatNumber(payload.state.current_number);
}

async function setBackendNumber(value) {
  return sendOperation("set", value);
}

function setExpressionMode() {
  if (!usingExpression) {
    expressionValue = displayValue === "0" ? "" : displayValue;
    usingExpression = true;
    pendingOperation = null;
    storedValue = null;
    setActiveOperator();
    updateOperationLabel();
  }
}

function isOperator(character) {
  return ["+", "-", "*", "/"].includes(character);
}

function getLastNumberMatch(expression) {
  return expression.match(/-?\d*\.?\d+(?:e[+-]?\d+)?$/i);
}

function replaceLastNumber(expression, replacement) {
  const match = getLastNumberMatch(expression);
  if (!match) return null;
  return `${expression.slice(0, match.index)}${replacement}`;
}

function inputNumber(number) {
  if (usingExpression) {
    if (justCalculated) {
      expressionValue = "";
      justCalculated = false;
    }

    if (expressionValue.endsWith(")")) {
      expressionValue += "*";
    }

    expressionValue += number;
    displayValue = expressionValue || "0";
    updateDisplay(waitingForNewNumber ? "number-enter" : "display-pop");
    waitingForNewNumber = false;
    justCalculated = false;
    return;
  }

  if (waitingForNewNumber || justCalculated) {
    displayValue = number;
    waitingForNewNumber = false;
    justCalculated = false;
    updateDisplay("number-enter");
  } else {
    displayValue = displayValue === "0" ? number : displayValue + number;
    updateDisplay("display-pop");
  }
}

function inputDecimal() {
  if (usingExpression) {
    const parts = expressionValue.split(/[+\-*/()]/);
    const currentPart = parts[parts.length - 1];
    if (!currentPart.includes(".")) {
      expressionValue += currentPart === "" ? "0." : ".";
      displayValue = expressionValue;
      updateDisplay("display-pop");
    }
    return;
  }

  if (waitingForNewNumber || justCalculated) {
    displayValue = "0.";
    waitingForNewNumber = false;
    justCalculated = false;
    updateDisplay("number-enter");
  } else if (!displayValue.includes(".")) {
    displayValue += ".";
    updateDisplay("display-pop");
  }
}

function deleteOneNumber() {
  if (usingExpression) {
    expressionValue = expressionValue.slice(0, -1);
    displayValue = expressionValue || "0";
    updateDisplay("display-pop");
    return;
  }

  if (waitingForNewNumber || justCalculated) {
    displayValue = "0";
    waitingForNewNumber = false;
    justCalculated = false;
  } else if (displayValue.length <= 1 || (displayValue.length === 2 && displayValue.startsWith("-"))) {
    displayValue = "0";
  } else {
    displayValue = displayValue.slice(0, -1);
  }

  updateDisplay("display-pop");
}

async function finishPendingOperation() {
  if (!pendingOperation || storedValue === null) return true;

  await setBackendNumber(storedValue);
  const result = await sendOperation(pendingOperation, displayValue);
  if (result === null) return false;

  displayValue = result;
  storedValue = result;
  updateDisplay("display-pop");
  return true;
}

async function chooseOperation(operation) {
  const symbol = operationSymbols[operation];
  if (!symbol) return;

  if (justCalculated) {
    expressionValue = displayValue;
    usingExpression = true;
    justCalculated = false;
  }

  if (!usingExpression) {
    expressionValue = displayValue;
    usingExpression = true;
  }

  if (/[+\-*/]$/.test(expressionValue)) {
    expressionValue = expressionValue.slice(0, -1) + symbol;
  } else {
    expressionValue += symbol;
  }

  displayValue = expressionValue;
  pendingOperation = operation;
  storedValue = null;
  waitingForNewNumber = true;
  justCalculated = false;
  updateOperationLabel();
  setActiveOperator();
  updateDisplay("display-pop");
}

async function calculateEquals() {
  if (usingExpression) {
    if (!expressionValue) return;

    const result = await sendOperation("evaluate", expressionValue);
    if (result === null) return;

    displayValue = result;
    expressionValue = "";
    usingExpression = false;
    pendingOperation = null;
    storedValue = null;
    waitingForNewNumber = true;
    justCalculated = true;
    updateDisplay("display-pop");
    updateOperationLabel();
    setActiveOperator();
    return;
  }

  if (!pendingOperation) return;

  const ok = await finishPendingOperation();
  if (!ok) return;

  pendingOperation = null;
  storedValue = null;
  waitingForNewNumber = true;
  justCalculated = true;
  updateOperationLabel();
  setActiveOperator();
}

async function runSingleOperation(operation) {
  if (usingExpression && expressionValue) {
    const match = getLastNumberMatch(expressionValue);
    if (!match) {
      showToast("Enter a number first");
      return;
    }

    await setBackendNumber(match[0]);
    const result = await sendOperation(operation);
    if (result === null) return;

    const nextExpression = replaceLastNumber(expressionValue, result);
    if (nextExpression === null) return;

    expressionValue = nextExpression;
    displayValue = expressionValue;
    waitingForNewNumber = false;
    justCalculated = false;
    updateDisplay("display-pop");
    updateOperationLabel();
    return;
  }

  await setBackendNumber(displayValue);
  const result = await sendOperation(operation);
  if (result === null) return;

  displayValue = result;
  pendingOperation = null;
  storedValue = null;
  waitingForNewNumber = true;
  justCalculated = true;
  updateDisplay("display-pop");
  updateOperationLabel();
  setActiveOperator();
}

async function clearCalculator() {
  displayValue = "0";
  expressionValue = "";
  storedValue = null;
  pendingOperation = null;
  waitingForNewNumber = false;
  justCalculated = false;
  usingExpression = false;
  await setBackendNumber(0);
  updateDisplay("display-pop");
  updateOperationLabel();
  setActiveOperator();
}

function toggleSign() {
  if (usingExpression) {
    const match = getLastNumberMatch(expressionValue);
    if (!match) return;

    const number = match[0];
    const before = expressionValue.slice(0, match.index);
    const replacement = number.startsWith("-") ? number.slice(1) : `-${number}`;
    expressionValue = `${before}${replacement}`;
    displayValue = expressionValue || "0";
    updateDisplay("display-pop");
    return;
  }

  if (displayValue === "0") return;
  displayValue = displayValue.startsWith("-") ? displayValue.slice(1) : `-${displayValue}`;
  updateDisplay("display-pop");
}

function inputParenthesis(parenthesis) {
  setExpressionMode();
  if (parenthesis === "(" && expressionValue && /[\d)]$/.test(expressionValue)) {
    expressionValue += "*";
  }
  expressionValue += parenthesis;
  displayValue = expressionValue;
  waitingForNewNumber = false;
  justCalculated = false;
  updateDisplay("number-enter");
}

async function handleAction(action) {
  if (action === "decimal") inputDecimal();
  if (action === "equals") await calculateEquals();
  if (action === "clear") await clearCalculator();
  if (action === "delete") deleteOneNumber();
  if (action === "sign") toggleSign();
  if (action === "openParen") inputParenthesis("(");
  if (action === "closeParen") inputParenthesis(")");
  if (action === "history") {
    const isOpen = historyPanel.classList.toggle("open");
    historyPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  if (action === "closeHistory") {
    historyPanel.classList.remove("open");
    historyPanel.setAttribute("aria-hidden", "true");
  }
}

document.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", async () => {
    button.classList.remove("pop");
    requestAnimationFrame(() => button.classList.add("pop"));

    if (button.dataset.number) {
      inputNumber(button.dataset.number);
    } else if (button.dataset.operation) {
      const operation = button.dataset.operation;

      if (["percentage", "sqrt", "square"].includes(operation)) {
        await runSingleOperation(operation);
      } else {
        await chooseOperation(operation);
      }
    } else if (button.dataset.action) {
      await handleAction(button.dataset.action);
    }
  });
});

document.querySelector("#clearHistory").addEventListener("click", () => {
  sendOperation("clear_history");
});

window.addEventListener("keydown", async (event) => {
  if (/^[0-9]$/.test(event.key)) inputNumber(event.key);
  if (event.key === ".") inputDecimal();
  if (event.key === "(") inputParenthesis("(");
  if (event.key === ")") inputParenthesis(")");
  if (event.key === "Backspace") deleteOneNumber();
  if (event.key === "Escape") await clearCalculator();
  if (event.key === "Enter" || event.key === "=") await calculateEquals();
  if (event.key === "+") await chooseOperation("add");
  if (event.key === "-") await chooseOperation("subtract");
  if (event.key === "*") await chooseOperation("multiply");
  if (event.key === "/") await chooseOperation("divide");
});

fetch("/api/state")
  .then((response) => response.json())
  .then((payload) => {
    displayValue = formatNumber(payload.state.current_number);
    updateDisplay();
    renderHistory(payload.state.history);
  })
  .catch(() => showToast("Could not connect to the Python backend."));

window.addEventListener("resize", resizeBackground);
window.addEventListener("mousemove", (event) => {
  mouse = { x: event.clientX, y: event.clientY, active: true };
});
window.addEventListener("mouseleave", () => {
  mouse.active = false;
});
window.addEventListener("touchmove", (event) => {
  const touch = event.touches[0];
  mouse = { x: touch.clientX, y: touch.clientY, active: true };
});
window.addEventListener("touchend", () => {
  mouse.active = false;
});

resizeBackground();
drawBackground();
