const SUITS = [
  { symbol: "♦", name: "Ro", rank: 4, color: "red" },
  { symbol: "♥", name: "Co", rank: 3, color: "red" },
  { symbol: "♠", name: "Bich", rank: 2, color: "black" },
  { symbol: "♣", name: "Tep", rank: 1, color: "black" },
];
const COLORS = ["#f7c955", "#8ce3ca", "#fa8c66", "#a7c9ff", "#e1a8f1", "#8ecf81", "#ffd59a", "#a4dfdd", "#e7a2a8", "#b8b5fc"];
const FRIENDS = ["Linh", "Huy", "Trang", "Quan", "Vy", "Khanh", "Nam", "An", "Mai"];

const state = { players: [], playerCount: 6, round: 1, turn: 1, dealing: false, readyForNextRound: false };
const el = (id) => document.getElementById(id);

function buildDeck() {
  return SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => ({ value: index + 1, suit })));
}

function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function startGame(event) {
  event.preventDefault();
  const name = el("playerName").value.trim() || "Minh";
  state.playerCount = Number(el("playerCount").value);
  state.round = 1;
  state.turn = 1;
  state.readyForNextRound = false;
  state.players = [{ name, score: 0, wins: 0 }, ...FRIENDS.slice(0, state.playerCount - 1).map((friend) => ({ name: friend, score: 0, wins: 0 }))];
  el("roomCode").textContent = `${name.toUpperCase().slice(0, 5)}-${String(Math.floor(100 + Math.random() * 900))}`;
  el("intro").classList.add("hidden");
  el("game").classList.remove("hidden");
  render();
}

function render() {
  el("roundLabel").textContent = `LUOT ${state.turn} · VAN ${state.round} / ${state.playerCount}`;
  el("gameTitle").textContent = state.round === 1 ? "San sang chia bai?" : `Van ${state.round}: may man se go cua ai?`;
  el("tableMessage").textContent = "Tat ca da vao ban. Chu phong chia bai nhe!";
  el("actionHint").textContent = "Moi nguoi nhan 3 cay bai up.";
  el("dealButton").textContent = "Chia bai  ↗";
  el("dealButton").disabled = false;
  el("resultPanel").classList.add("hidden");
  renderProgress();
  renderPlayers();
  renderScores();
}

function renderProgress() {
  el("roundProgress").innerHTML = Array.from({ length: state.playerCount }, (_, index) => `<span class="${index + 1 < state.round ? "complete" : index + 1 === state.round ? "current" : ""}"></span>`).join("");
}

function renderPlayers(hands = null, winnerIndexes = []) {
  const grid = el("playersGrid");
  grid.innerHTML = "";
  state.players.forEach((player, index) => {
    const seat = el("playerTemplate").content.firstElementChild.cloneNode(true);
    seat.classList.toggle("is-winner", winnerIndexes.includes(index));
    seat.querySelector(".avatar").textContent = player.name.slice(0, 1).toUpperCase();
    seat.querySelector(".avatar").style.setProperty("--avatar", COLORS[index]);
    seat.querySelector(".player-name").textContent = player.name;
    seat.querySelector(".win-count").textContent = `${player.wins} thang`;
    const cards = seat.querySelector(".cards");
    const cardsToShow = hands ? hands[index] : Array(3).fill(null);
    cardsToShow.forEach((card, cardIndex) => {
      const node = document.createElement("span");
      node.className = card ? `card ${card.suit.color}` : "card back";
      node.style.setProperty("--tilt", `${(cardIndex - 1) * 5}deg`);
      if (card) node.innerHTML = `${card.value}<small>${card.suit.symbol}</small>`;
      cards.append(node);
    });
    if (hands) {
      const result = evaluateHand(hands[index]);
      seat.querySelector(".hand-result").textContent = handSummary(result);
    }
    grid.append(seat);
  });
}

function evaluateHand(hand) {
  const total = hand.reduce((sum, card) => sum + card.value, 0);
  const highSuit = hand.reduce((highest, card) => card.suit.rank > highest.rank ? card.suit : highest, hand[0].suit);
  const highValue = Math.max(...hand.map((card) => card.value));
  const values = hand.map((card) => card.value).sort((a, b) => a - b);
  const isFlush = hand.every((card) => card.suit.rank === hand[0].suit.rank);
  const isStraight = values[1] === values[0] + 1 && values[2] === values[1] + 1;
  const isTriple = values[0] === values[2];
  // In this table's rules, a total ending in zero is the highest hand: 10 points.
  const score = total % 10 || 10;
  const typeRank = isStraight && isFlush ? 3 : isTriple ? 2 : 1;
  const typeName = typeRank === 3 ? "Sanh dong chat" : typeRank === 2 ? "Bo ba" : "Diem";
  const primary = typeRank === 3 ? values[2] : typeRank === 2 ? values[0] : score;
  return { total, score, highSuit, highValue, typeRank, typeName, primary };
}

function compareHands(first, second) {
  const a = evaluateHand(first);
  const b = evaluateHand(second);
  return a.typeRank - b.typeRank || a.primary - b.primary || a.highSuit.rank - b.highSuit.rank || a.highValue - b.highValue;
}

function handSummary(result) {
  if (result.typeRank === 3) return `${result.typeName} · cao ${result.primary} · ${result.highSuit.name}`;
  if (result.typeRank === 2) return `${result.typeName} ${result.primary} · ${result.highSuit.name}`;
  return `${result.score} diem · chat cao: ${result.highSuit.name}`;
}

async function deal() {
  if (state.dealing) return;
  if (state.readyForNextRound) {
    state.round++;
    state.readyForNextRound = false;
    render();
    return;
  }
  state.dealing = true;
  el("dealButton").disabled = true;
  el("dealButton").textContent = "Dang chia...";
  el("tableMessage").textContent = "Xao bai that deu... bai dang den tay moi nguoi.";

  const deck = shuffle(buildDeck());
  const hands = state.players.map((_, index) => [deck[index], deck[index + state.playerCount], deck[index + state.playerCount * 2]]);
  renderPlayers();
  document.querySelectorAll(".card").forEach((card, index) => {
    card.classList.add("dealing");
    setTimeout(() => card.classList.remove("dealing"), 80 + index * 55);
  });
  await wait(1250);
  el("tableMessage").textContent = "Ba cay up roi. Bay gio moi nguoi cung mo bai...";
  await wait(800);
  renderPlayers(hands);
  await wait(750);
  finishRound(hands);
  state.dealing = false;
}

function finishRound(hands) {
  let best = 0;
  for (let index = 1; index < hands.length; index++) if (compareHands(hands[index], hands[best]) > 0) best = index;
  const winners = hands.map((hand, index) => compareHands(hand, hands[best]) === 0 ? index : -1).filter((index) => index >= 0);
  winners.forEach((index) => state.players[index].wins++);
  renderPlayers(hands, winners);
  renderScores();
  const winnerNames = winners.map((index) => state.players[index].name).join(" va ");
  const result = evaluateHand(hands[best]);
  el("tableMessage").textContent = `${winnerNames} thang van nay voi ${handSummary(result)}!`;
  el("gameTitle").textContent = `${winnerNames} dang may man!`;
  const button = el("dealButton");
  if (state.round < state.playerCount) {
    state.readyForNextRound = true;
    button.disabled = false;
    button.textContent = "Van tiep theo  ↗";
    el("actionHint").textContent = `Con ${state.playerCount - state.round} van trong luot nay.`;
  } else {
    applyTurnScores();
    renderScores();
    showTurnResult();
  }
}

function applyTurnScores() {
  state.players.forEach((player) => { player.score += 60 * (player.wins - 1); });
}

function renderScores() {
  const sorted = [...state.players].sort((a, b) => b.score - a.score || b.wins - a.wins || a.name.localeCompare(b.name));
  el("scoreboardList").innerHTML = sorted.map((player) => `<li><span class="score-name">${player.name}${player.wins ? ` <small>(${player.wins}W)</small>` : ""}</span><strong class="score-value">${player.score > 0 ? "+" : ""}${player.score}</strong></li>`).join("");
}

function showTurnResult() {
  const champion = [...state.players].sort((a, b) => b.wins - a.wins || b.score - a.score)[0];
  const panel = el("resultPanel");
  panel.innerHTML = `<p class="eyebrow">KET THUC LUOT ${state.turn}</p><h3>${champion.name} noi bat voi ${champion.wins} van thang</h3><p>Diem da cong tru theo so van thang. Choi them mot luot nua de lat keo bang xep hang!</p><button type="button" id="nextTurn">Bat dau luot ${state.turn + 1}</button>`;
  panel.classList.remove("hidden");
  el("dealButton").classList.add("hidden");
  el("actionHint").textContent = "Bang diem ben phai da duoc cap nhat.";
  el("nextTurn").onclick = () => {
    state.turn++;
    state.round = 1;
    state.readyForNextRound = false;
    state.players.forEach((player) => { player.wins = 0; });
    el("dealButton").classList.remove("hidden");
    render();
  };
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

el("joinForm").addEventListener("submit", startGame);
el("dealButton").addEventListener("click", deal);
el("resetButton").addEventListener("click", () => window.location.reload());
