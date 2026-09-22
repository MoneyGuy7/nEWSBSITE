// ============================================================
// games.js — tic-tac-toe (vs a simple bot) and snake
// ============================================================

(function () {
  const tabs = document.querySelectorAll(".game-tab");
  const panels = {
    ttt: document.getElementById("panel-ttt"),
    snake: document.getElementById("panel-snake"),
    memory: document.getElementById("panel-memory"),
    g2048: document.getElementById("panel-g2048"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle("active", key === tab.dataset.game));
      if (tab.dataset.game === "snake") Snake.focusCanvas();
    });
  });

  window.YaktonGames = {
    onShow() { /* no-op hook, kept for main.js */ },
  };
})();

// ---------------- Tic-tac-toe ----------------
const TicTacToe = (function () {
  const boardEl = document.getElementById("tttBoard");
  const statusEl = document.getElementById("tttStatus");
  const resetBtn = document.getElementById("tttReset");
  let board = Array(9).fill(null);
  let gameOver = false;

  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function render() {
    boardEl.innerHTML = "";
    board.forEach((val, i) => {
      const cell = document.createElement("button");
      cell.className = "ttt-cell" + (val ? " " + val.toLowerCase() : "");
      cell.textContent = val || "";
      cell.addEventListener("click", () => playerMove(i));
      boardEl.appendChild(cell);
    });
  }

  function winner(b) {
    for (const [a, c, d] of WINS) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every(Boolean) ? "draw" : null;
  }

  function playerMove(i) {
    if (gameOver || board[i]) return;
    board[i] = "X";
    render();
    const w = winner(board);
    if (w) return finish(w);
    statusEl.textContent = "Yakton is thinking…";
    setTimeout(botMove, 260);
  }

  function botMove() {
    if (gameOver) return;
    const empty = board.map((v, i) => (v ? null : i)).filter((v) => v !== null);
    // try to win, then block, then random
    const pick = findTactical("O") ?? findTactical("X") ?? empty[Math.floor(Math.random() * empty.length)];
    board[pick] = "O";
    render();
    const w = winner(board);
    if (w) return finish(w);
    statusEl.textContent = "Your move — X.";
  }

  function findTactical(mark) {
    for (const [a, c, d] of WINS) {
      const line = [board[a], board[c], board[d]];
      const idxs = [a, c, d];
      const marks = line.filter((v) => v === mark).length;
      const empties = idxs.filter((i) => !board[i]);
      if (marks === 2 && empties.length === 1) return empties[0];
    }
    return null;
  }

  function finish(w) {
    gameOver = true;
    statusEl.textContent = w === "draw" ? "Draw. Reset to play again." : `${w} wins! Reset to play again.`;
  }

  function reset() {
    board = Array(9).fill(null);
    gameOver = false;
    statusEl.textContent = "Your move — X starts.";
    render();
  }

  resetBtn.addEventListener("click", reset);
  render();
  return { reset };
})();

// ---------------- Snake ----------------
const Snake = (function () {
  const canvas = document.getElementById("snakeCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("snakeScore");
  const CELL = 18;
  const COLS = canvas.width / CELL;
  const ROWS = canvas.height / CELL;

  let snake, dir, nextDir, food, score, running, loopId;

  function reset() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    scoreEl.textContent = score;
    placeFood();
    running = false;
    draw();
  }

  function placeFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) {
      running = false;
      clearInterval(loopId);
      draw(true);
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw(gameOver) {
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff6b7a";
    ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);

    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#5b8cff" : "#6be3ae";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });

    if (gameOver) {
      ctx.fillStyle = "rgba(5,7,12,0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#eaf0fa";
      ctx.font = "600 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Game over — press space", canvas.width / 2, canvas.height / 2);
    } else if (!running) {
      ctx.fillStyle = "rgba(5,7,12,0.6)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#eaf0fa";
      ctx.font = "600 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press space to start", canvas.width / 2, canvas.height / 2);
    }
  }

  function start() {
    if (running) return;
    running = true;
    loopId = setInterval(tick, 110);
  }

  const keyMap = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
  };

  window.addEventListener("keydown", (e) => {
    if (!document.getElementById("panel-snake").classList.contains("active")) return;
    if (e.key === " ") {
      e.preventDefault();
      if (!running) { reset(); start(); }
      return;
    }
    const nd = keyMap[e.key];
    if (!nd) return;
    e.preventDefault();
    // prevent reversing directly into itself
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  });

  reset();
  return { focusCanvas: () => canvas.focus() };
})();

// ---------------- Memory match ----------------
const MemoryMatch = (function () {
  const boardEl = document.getElementById("memoryBoard");
  const statusEl = document.getElementById("memoryStatus");
  const resetBtn = document.getElementById("memoryReset");
  if (!boardEl) return;

  const SYMBOLS = ["📈", "📉", "💹", "🪙", "⚡", "🔷", "✨", "🚀"];
  let cards, flipped, matchedCount, moves, locked;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reset() {
    cards = shuffle([...SYMBOLS, ...SYMBOLS]).map((symbol) => ({ symbol, flipped: false, matched: false }));
    flipped = [];
    matchedCount = 0;
    moves = 0;
    locked = false;
    statusEl.textContent = "Find every pair in as few moves as you can.";
    render();
  }

  function render() {
    boardEl.innerHTML = "";
    cards.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.className = "memory-card" + (card.flipped || card.matched ? " flipped" : "") + (card.matched ? " matched" : "");
      btn.textContent = card.flipped || card.matched ? card.symbol : "";
      btn.disabled = card.matched || locked;
      btn.addEventListener("click", () => flip(i));
      boardEl.appendChild(btn);
    });
  }

  function flip(i) {
    if (locked || cards[i].flipped || cards[i].matched) return;
    cards[i].flipped = true;
    flipped.push(i);
    render();

    if (flipped.length === 2) {
      moves++;
      const [a, b] = flipped;
      if (cards[a].symbol === cards[b].symbol) {
        cards[a].matched = true;
        cards[b].matched = true;
        matchedCount++;
        flipped = [];
        statusEl.textContent = `Match! ${moves} move${moves === 1 ? "" : "s"} so far.`;
        if (matchedCount === SYMBOLS.length) {
          statusEl.textContent = `Solved in ${moves} moves. Shuffle to play again.`;
        }
        render();
      } else {
        locked = true;
        statusEl.textContent = "No match — resetting those two.";
        setTimeout(() => {
          cards[a].flipped = false;
          cards[b].flipped = false;
          flipped = [];
          locked = false;
          statusEl.textContent = `${moves} moves so far.`;
          render();
        }, 700);
      }
    }
  }

  resetBtn.addEventListener("click", reset);
  reset();
  return { reset };
})();

// ---------------- 2048 ----------------
const Game2048 = (function () {
  const boardEl = document.getElementById("g2048Board");
  const scoreEl = document.getElementById("g2048Score");
  const resetBtn = document.getElementById("g2048Reset");
  if (!boardEl) return;

  const statusEl = document.getElementById("g2048Status");
  const SIZE = 4;
  let grid, score, over;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function reset() {
    grid = emptyGrid();
    score = 0;
    over = false;
    if (statusEl) statusEl.textContent = "Arrow keys or WASD to slide the tiles.";
    addTile();
    addTile();
    render();
  }

  function addTile() {
    const empties = [];
    grid.forEach((row, r) => row.forEach((v, c) => { if (!v) empties.push([r, c]); }));
    if (!empties.length) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function render() {
    boardEl.innerHTML = "";
    grid.forEach((row) => row.forEach((v) => {
      const cell = document.createElement("div");
      cell.className = "g2048-tile";
      if (v) { cell.dataset.v = v; cell.textContent = v; }
      boardEl.appendChild(cell);
    }));
    scoreEl.textContent = score;
  }

  // Slide + merge a single row toward index 0; returns {row, moved, gained}
  function collapseRow(row) {
    const vals = row.filter((v) => v);
    const result = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) {
        const merged = vals[i] * 2;
        result.push(merged);
        gained += merged;
        i++;
      } else {
        result.push(vals[i]);
      }
    }
    while (result.length < SIZE) result.push(0);
    const moved = result.some((v, i) => v !== row[i]);
    return { row: result, moved, gained };
  }

  function rotateCW(g) {
    const n = emptyGrid();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) n[c][SIZE - 1 - r] = g[r][c];
    return n;
  }

  function move(dir) {
    if (over) return;
    // normalize so we can always collapse "left": rotate grid, collapse rows, rotate back
    const rotations = { left: 0, up: 1, right: 2, down: 3 };
    let g = grid;
    for (let i = 0; i < rotations[dir]; i++) g = rotateCW(g);

    let moved = false, gained = 0;
    const next = g.map((row) => {
      const res = collapseRow(row);
      if (res.moved) moved = true;
      gained += res.gained;
      return res.row;
    });

    let restored = next;
    for (let i = 0; i < (4 - rotations[dir]) % 4; i++) restored = rotateCW(restored);

    if (!moved) return;
    grid = restored;
    score += gained;
    addTile();
    render();
    checkGameOver();
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function checkGameOver() {
    if (!canMove()) {
      over = true;
      if (statusEl) statusEl.textContent = "No more moves — start a new game.";
    }
  }

  const keyMap = {
    ArrowLeft: "left", a: "left",
    ArrowRight: "right", d: "right",
    ArrowUp: "up", w: "up",
    ArrowDown: "down", s: "down",
  };

  window.addEventListener("keydown", (e) => {
    if (!document.getElementById("panel-g2048").classList.contains("active")) return;
    const dir = keyMap[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  resetBtn.addEventListener("click", reset);
  reset();
  return { reset };
})();
