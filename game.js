const COLS = 6;
const ROWS = 4;

const symbols = [
  { id: "helmet", icon: "🪖", type: "normal", value: 40 },
  { id: "goblet", icon: "🏆", type: "normal", value: 35 },
  { id: "ring", icon: "💍", type: "normal", value: 30 },
  { id: "crown", icon: "👑", type: "normal", value: 28 },
  { id: "heart", icon: "❤️", type: "normal", value: 16 },
  { id: "spade", icon: "♠️", type: "normal", value: 16 },
  { id: "diamond", icon: "🔷", type: "normal", value: 10 },
  { id: "club", icon: "♣️", type: "normal", value: 10 },
  { id: "wild", icon: "🏛️", type: "wild", value: 0 },
  { id: "bonus", icon: "🐷", type: "bonus", value: 0 },
  { id: "collect", icon: "⚡", type: "collect", value: 0 },
  { id: "cash", icon: "🪙", type: "cash", value: 0 }
];

let grid = [];
let credits = 1000;
let bet = 20;
let win = 0;
let freeSpins = 0;
let multiplierIndex = -1;
let spinning = false;

const slotGrid = document.getElementById("slotGrid");
const creditsEl = document.getElementById("credits");
const betEl = document.getElementById("bet");
const winEl = document.getElementById("win");
const messageEl = document.getElementById("message");
const spinButton = document.getElementById("spinButton");
const resetButton = document.getElementById("resetButton");
const freeSpinsEl = document.getElementById("freeSpins");
const freeSpinsPanel = document.getElementById("freeSpinsPanel");
const ladderEls = document.querySelectorAll("#multiplierLadder span");
const totalWinBanner = document.getElementById("totalWinBanner");
const totalFreeWin = document.getElementById("totalFreeWin");
const closeBanner = document.getElementById("closeBanner");

function randomSymbol() {
  const roll = Math.random();

  if (roll < 0.06) {
    const values = [10, 20, 30, 40, 50, 75, 100];
    return {
      ...symbols.find(s => s.id === "cash"),
      cashValue: values[Math.floor(Math.random() * values.length)]
    };
  }

  if (roll < 0.10) return { ...symbols.find(s => s.id === "collect") };
  if (roll < 0.15) return { ...symbols.find(s => s.id === "bonus") };
  if (roll < 0.22) return { ...symbols.find(s => s.id === "wild") };

  const normal = symbols.filter(s => s.type === "normal");
  return { ...normal[Math.floor(Math.random() * normal.length)] };
}

function createGrid() {
  grid = [];

  for (let col = 0; col < COLS; col++) {
    grid[col] = [];
    for (let row = 0; row < ROWS; row++) {
      grid[col][row] = randomSymbol();
    }
  }
}

function renderGrid() {
  slotGrid.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const s = grid[col][row];
      const cell = document.createElement("div");

      cell.className = `symbol ${s.type}`;
      cell.dataset.col = col;
      cell.dataset.row = row;

      if (s.type === "cash") {
        cell.innerHTML = `${s.icon}<small style="font-size:14px;display:block;">${s.cashValue}</small>`;
      } else {
        cell.textContent = s.icon;
      }

      slotGrid.appendChild(cell);
    }
  }
}

function updateUI() {
  creditsEl.textContent = credits;
  betEl.textContent = bet;
  winEl.textContent = win;
  freeSpinsEl.textContent = freeSpins;

  freeSpinsPanel.classList.toggle("hidden", freeSpins <= 0);

  ladderEls.forEach((el, index) => {
    el.classList.toggle("active", index <= multiplierIndex);
  });
}

function currentMultiplier() {
  if (multiplierIndex < 0) return 1;
  return [2, 4, 8, 16][multiplierIndex];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function spin() {
  if (spinning) return;

  if (credits < bet && freeSpins <= 0) {
    messageEl.textContent = "Not enough credits.";
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  win = 0;
  updateUI();

  if (freeSpins > 0) {
    freeSpins--;
    messageEl.textContent = `Free Spin! ${freeSpins} remaining.`;
  } else {
    credits -= bet;

    if (Math.random() < 1 / 15) {
      multiplierIndex = 0;
      messageEl.textContent = "⚡ Olympian Strike activated!";
    } else {
      multiplierIndex = -1;
      messageEl.textContent = "Spinning...";
    }
  }

  updateUI();

  for (let i = 0; i < 12; i++) {
    createGrid();
    renderGrid();
    await sleep(55);
  }

  let totalWin = 0;

  const collectWin = evaluateCashCollect();

  if (collectWin > 0) {
    const collectTotal = collectWin * currentMultiplier();
    totalWin += collectTotal;
    messageEl.textContent = `⚡ Cash Collect: ${collectWin} x${currentMultiplier()} = ${collectTotal}`;
    await sleep(900);
  }

  for (let cascade = 1; cascade <= 6; cascade++) {
    const result = evaluateWins();

    if (result.amount <= 0) break;

    const multiplier = currentMultiplier();
    const cascadeWin = result.amount * multiplier;
    totalWin += cascadeWin;

    highlightWins(result.cells);
    messageEl.textContent = `✨ Cascade ${cascade}: ${result.amount} x${multiplier} = ${cascadeWin}`;
    await sleep(900);

    removeWins(result.cells);
    dropSymbols();

    if (multiplierIndex >= 0 && multiplierIndex < 3) {
      multiplierIndex++;
      messageEl.textContent = `⚡ Multiplier increased to x${currentMultiplier()}!`;
      updateUI();
      await sleep(500);
    }

    renderGrid();
    updateUI();
    await sleep(500);
  }

  win = totalWin;
  credits += totalWin;

  const bonusCount = countType("bonus");

  if (bonusCount >= 3 && freeSpins <= 0) {
    freeSpins = 8;
    messageEl.textContent = "🐷 Zeus Pig triggered 8 Free Spins!";
  } else {
    messageEl.textContent = totalWin > 0 ? `🎉 Total win: ${totalWin}` : "No win. Spin again!";
  }

  updateUI();

  spinning = false;
  spinButton.disabled = false;
}
function evaluateCashCollect() {
  let cashTotal = 0;
  let collectors = 0;
  const cashValues = [];

  forEachSymbol(s => {
    if (s.type === "cash") {
      cashTotal += s.cashValue || 0;
      cashValues.push(s.cashValue || 0);
    }

    if (s.type === "collect") {
      collectors++;
    }
  });

  if (cashTotal > 0 && collectors > 0) {
    messageEl.textContent = `⚡ COLLECT! Coins ${cashValues.join(" + ")} = ${cashTotal} × ${collectors} collector(s)`;
    return cashTotal * collectors;
  }

  return 0;
}
}

function evaluateWins() {
  let amount = 0;
  const cells = new Set();

  const normalSymbols = symbols.filter(s => s.type === "normal");

  normalSymbols.forEach(target => {
    let matchedCols = 0;
    let ways = 1;
    const matchedCells = [];

    for (let col = 0; col < COLS; col++) {
      const colMatches = [];

      for (let row = 0; row < ROWS; row++) {
        const s = grid[col][row];

        if (s.id === target.id || s.type === "wild") {
          colMatches.push(`${col}-${row}`);
        }
      }

      if (colMatches.length === 0) break;

      matchedCols++;
      ways *= colMatches.length;
      matchedCells.push(...colMatches);
    }

    if (matchedCols >= 3) {
      amount += target.value * matchedCols * ways;
      matchedCells.forEach(c => cells.add(c));
    }
  });

  return { amount, cells };
}

function highlightWins(cells) {
  document.querySelectorAll(".symbol").forEach(el => {
    const key = `${el.dataset.col}-${el.dataset.row}`;
    if (cells.has(key)) el.classList.add("win");
  });
}

function removeWins(cells) {
  cells.forEach(key => {
    const [col, row] = key.split("-").map(Number);

    if (grid[col][row].type !== "collect") {
      grid[col][row] = null;
    }
  });
}

function dropSymbols() {
  for (let col = 0; col < COLS; col++) {
    const remaining = grid[col].filter(Boolean);
    const missing = ROWS - remaining.length;
    const newSymbols = [];

    for (let i = 0; i < missing; i++) {
      newSymbols.push(randomSymbol());
    }

    grid[col] = [...newSymbols, ...remaining];
  }
}

function countType(type) {
  let count = 0;

  forEachSymbol(s => {
    if (s.type === type) count++;
  });

  return count;
}

function forEachSymbol(callback) {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      callback(grid[col][row], col, row);
    }
  }
}

function resetGame() {
  credits = 1000;
  bet = 20;
  win = 0;
  freeSpins = 0;
  multiplierIndex = -1;
  spinning = false;

  createGrid();
  renderGrid();
  updateUI();

  totalWinBanner.classList.add("hidden");
  messageEl.textContent = "Game reset. Press SPIN.";
}

spinButton.addEventListener("click", spin);
resetButton.addEventListener("click", resetGame);

closeBanner.addEventListener("click", () => {
  totalWinBanner.classList.add("hidden");
});

createGrid();
renderGrid();
updateUI();
