import { db, isFirebaseConfigured, onValue, ref, runTransaction, set } from "./firebase.js";

const SUITS = [
  { symbol: "♦", name: "Ro", rank: 4, color: "red" },
  { symbol: "♥", name: "Co", rank: 3, color: "red" },
  { symbol: "♠", name: "Bich", rank: 2, color: "black" },
  { symbol: "♣", name: "Tep", rank: 1, color: "black" },
];
const COLORS = ["#f7c955", "#8ce3ca", "#fa8c66", "#a7c9ff", "#e1a8f1", "#8ecf81", "#ffd59a", "#a4dfdd", "#e7a2a8", "#b8b5fc"];
const el = (id) => document.getElementById(id);
const playerId = localStorage.getItem("ba-cay-player-id") || crypto.randomUUID();
localStorage.setItem("ba-cay-player-id", playerId);

const state = { room: null, roomCode: location.hash.replace("#", "").toUpperCase(), resolving: false };

function playerList(room = state.room) {
  return Object.entries(room?.players || {}).map(([id, player]) => ({ id, ...player })).sort((a, b) => a.joinedAt - b.joinedAt);
}

function buildDeck() { return SUITS.flatMap((suit) => Array.from({ length: 9 }, (_, index) => ({ value: index + 1, suit }))); }

function shuffle(cards) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function evaluateHand(hand) {
  const total = hand.reduce((sum, card) => sum + card.value, 0);
  const highSuit = hand.reduce((highest, card) => card.suit.rank > highest.rank ? card.suit : highest, hand[0].suit);
  const highValue = Math.max(...hand.map((card) => card.value));
  const values = hand.map((card) => card.value).sort((a, b) => a - b);
  const isFlush = hand.every((card) => card.suit.rank === hand[0].suit.rank);
  const isStraight = values[1] === values[0] + 1 && values[2] === values[1] + 1;
  const isTriple = values[0] === values[2];
  const score = total % 10 || 10;
  const typeRank = isStraight && isFlush ? 3 : isTriple ? 2 : 1;
  const typeName = typeRank === 3 ? "Sanh dong chat" : typeRank === 2 ? "Bo ba" : "Diem";
  const primary = typeRank === 3 ? values[2] : typeRank === 2 ? values[0] : score;
  return { score, highSuit, highValue, typeRank, typeName, primary };
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

function makeRoomCode() { return Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""); }

async function createRoom(event) {
  event.preventDefault();
  if (!isFirebaseConfigured) return showSetupMessage();
  const name = el("playerName").value.trim().slice(0, 18);
  if (!name) return setIntroMessage("Nhap ten truoc khi tao phong nhe.");
  const code = makeRoomCode();
  const maxPlayers = Number(el("playerCount").value);
  await set(ref(db, `rooms/${code}`), {
    hostId: playerId, maxPlayers, phase: "waiting", turn: 1, round: 1, createdAt: Date.now(),
    players: { [playerId]: { name, score: 0, wins: 0, joinedAt: Date.now() } },
  });
  location.hash = code;
}

async function joinRoom(event) {
  event.preventDefault();
  if (!isFirebaseConfigured) return showSetupMessage();
  const name = el("playerName").value.trim().slice(0, 18);
  if (!name) return setIntroMessage("Nhap ten truoc khi vao phong nhe.");
  const result = await runTransaction(ref(db, `rooms/${state.roomCode}`), (room) => {
    if (!room || room.phase !== "waiting") return;
    const players = room.players || {};
    if (!players[playerId] && Object.keys(players).length >= room.maxPlayers) return;
    players[playerId] = players[playerId] || { name, score: 0, wins: 0, joinedAt: Date.now() };
    return { ...room, players };
  });
  if (!result.committed) setIntroMessage("Phong da day, da bat dau, hoac khong ton tai.");
}

async function startRoom() {
  await runTransaction(ref(db, `rooms/${state.roomCode}`), (room) => {
    if (!room || room.hostId !== playerId || room.phase !== "waiting" || Object.keys(room.players || {}).length !== room.maxPlayers) return;
    return { ...room, phase: "playing" };
  });
}

async function deal() {
  if (state.resolving || state.room?.hostId !== playerId || state.room?.phase !== "playing") return;
  state.resolving = true;
  const players = playerList();
  const deck = shuffle(buildDeck());
  const hands = Object.fromEntries(players.map((player, index) => [player.id, [deck[index], deck[index + players.length], deck[index + players.length * 2]]]));
  await runTransaction(ref(db, `rooms/${state.roomCode}`), (room) => {
    if (!room || room.hostId !== playerId || room.phase !== "playing") return;
    return { ...room, hands, phase: "revealing", winnerIds: [] };
  });
  window.setTimeout(resolveRound, 2800);
}

async function resolveRound() {
  const room = state.room;
  if (!room || room.hostId !== playerId || room.phase !== "revealing") return;
  await runTransaction(ref(db, `rooms/${state.roomCode}`), (current) => {
    if (!current || current.hostId !== playerId || current.phase !== "revealing") return;
    const players = playerList(current);
    let best = players[0];
    players.slice(1).forEach((player) => { if (compareHands(current.hands[player.id], current.hands[best.id]) > 0) best = player; });
    const winnerIds = players.filter((player) => compareHands(current.hands[player.id], current.hands[best.id]) === 0).map((player) => player.id);
    winnerIds.forEach((id) => { current.players[id].wins += 1; });
    const isTurnOver = current.round === current.maxPlayers;
    if (isTurnOver) Object.values(current.players).forEach((player) => { player.score += 60 * (player.wins - 1); });
    return { ...current, phase: isTurnOver ? "turn-result" : "round-result", winnerIds };
  });
  state.resolving = false;
}

async function nextRound() {
  await runTransaction(ref(db, `rooms/${state.roomCode}`), (room) => {
    if (!room || room.hostId !== playerId || room.phase !== "round-result") return;
    return { ...room, round: room.round + 1, phase: "playing", hands: null, winnerIds: [] };
  });
}

async function nextTurn() {
  await runTransaction(ref(db, `rooms/${state.roomCode}`), (room) => {
    if (!room || room.hostId !== playerId || room.phase !== "turn-result") return;
    Object.values(room.players).forEach((player) => { player.wins = 0; });
    return { ...room, turn: room.turn + 1, round: 1, phase: "playing", hands: null, winnerIds: [] };
  });
}

function renderRoom(room) {
  state.room = room;
  if (!room) return setIntroMessage("Phong nay khong ton tai hoac da bi xoa.");
  el("intro").classList.add("hidden");
  el("roomCode").textContent = state.roomCode;
  if (room.phase === "waiting") return renderLobby(room);
  el("lobby").classList.add("hidden");
  el("game").classList.remove("hidden");
  renderGame(room);
}

function renderLobby(room) {
  const players = playerList(room);
  const host = room.hostId === playerId;
  el("game").classList.add("hidden");
  el("lobby").classList.remove("hidden");
  el("lobbyTitle").textContent = `Phong ${state.roomCode}`;
  el("lobbyCount").textContent = `${players.length} / ${room.maxPlayers} nguoi da vao`;
  el("lobbyPlayers").innerHTML = players.map((player, index) => `<li><span class="avatar" style="--avatar:${COLORS[index]}">${player.name.slice(0, 1).toUpperCase()}</span><strong>${escapeHtml(player.name)}</strong>${player.id === room.hostId ? "<small>CHU PHONG</small>" : ""}</li>`).join("");
  el("shareLink").value = location.href;
  const ready = players.length === room.maxPlayers;
  el("startButton").classList.toggle("hidden", !host);
  el("startButton").disabled = !ready;
  el("startButton").textContent = ready ? "Bat dau choi  ↗" : `Cho du ${room.maxPlayers - players.length} nguoi`;
  el("lobbyNotice").textContent = host ? (ready ? "Da du nguoi. Ban co the bat dau!" : "Gui link nay cho anh em. Chu phong se bat dau khi phong du nguoi.") : "Da vao phong. Cho chu phong bat dau nhe!";
}

function renderGame(room) {
  const players = playerList(room);
  const hands = room.hands;
  const winnerIds = room.winnerIds || [];
  const isHost = room.hostId === playerId;
  el("resultPanel").classList.add("hidden");
  el("roundLabel").textContent = `LUOT ${room.turn} · VAN ${room.round} / ${room.maxPlayers}`;
  el("gameTitle").textContent = room.phase === "revealing" ? "Bai dang mo..." : room.phase === "turn-result" ? "Ket thuc luot!" : "San sang chia bai?";
  el("roundProgress").innerHTML = Array.from({ length: room.maxPlayers }, (_, index) => `<span class="${index + 1 < room.round ? "complete" : index + 1 === room.round ? "current" : ""}"></span>`).join("");
  renderPlayers(players, hands, winnerIds, room.phase !== "playing");
  renderScores(players);
  const button = el("dealButton");
  button.classList.toggle("hidden", !isHost || room.phase === "turn-result");
  button.disabled = !isHost || room.phase === "revealing";
  if (room.phase === "playing") {
    button.textContent = "Chia bai  ↗"; button.onclick = deal;
    el("tableMessage").textContent = isHost ? "Tat ca da vao ban. Chu phong chia bai nhe!" : "Cho chu phong chia bai...";
    el("actionHint").textContent = "Moi nguoi nhan 3 cay bai up.";
  } else if (room.phase === "revealing") {
    button.textContent = "Dang mo bai..."; el("tableMessage").textContent = "Ba cay da up. Bay gio cung mo bai nao!";
    el("actionHint").textContent = "Ket qua dang dong bo cho ca phong.";
  } else {
    const winnerNames = winnerIds.map((id) => players.find((player) => player.id === id)?.name).join(" va ");
    const bestHand = hands?.[winnerIds[0]];
    el("tableMessage").textContent = `${winnerNames} thang van nay voi ${bestHand ? handSummary(evaluateHand(bestHand)) : "bai cao"}!`;
    if (room.phase === "round-result") {
      button.textContent = "Van tiep theo  ↗"; button.onclick = nextRound;
      el("actionHint").textContent = `Con ${room.maxPlayers - room.round} van trong luot nay.`;
    } else {
      el("resultPanel").innerHTML = `<p class="eyebrow">KET THUC LUOT ${room.turn}</p><h3>Bang diem da duoc cap nhat</h3><p>Chu phong co the bat dau luot moi khi moi nguoi san sang.</p>${isHost ? '<button type="button" id="nextTurn">Bat dau luot tiep theo</button>' : ""}`;
      el("resultPanel").classList.remove("hidden");
      el("nextTurn")?.addEventListener("click", nextTurn);
    }
  }
}

function renderPlayers(players, hands, winnerIds, reveal) {
  const grid = el("playersGrid"); grid.innerHTML = "";
  players.forEach((player, index) => {
    const seat = el("playerTemplate").content.firstElementChild.cloneNode(true);
    seat.classList.toggle("is-winner", winnerIds.includes(player.id));
    seat.querySelector(".avatar").textContent = player.name.slice(0, 1).toUpperCase();
    seat.querySelector(".avatar").style.setProperty("--avatar", COLORS[index]);
    seat.querySelector(".player-name").textContent = player.name;
    seat.querySelector(".win-count").textContent = `${player.wins} thang`;
    const hand = hands?.[player.id];
    (hand || Array(3).fill(null)).forEach((card, cardIndex) => {
      const node = document.createElement("span");
      node.className = card && reveal ? `card ${card.suit.color}` : "card back";
      node.style.setProperty("--tilt", `${(cardIndex - 1) * 5}deg`);
      if (card && reveal) node.innerHTML = `${card.value}<small>${card.suit.symbol}</small>`;
      seat.querySelector(".cards").append(node);
    });
    if (hand && reveal) seat.querySelector(".hand-result").textContent = handSummary(evaluateHand(hand));
    grid.append(seat);
  });
}

function renderScores(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || b.wins - a.wins || a.name.localeCompare(b.name));
  el("scoreboardList").innerHTML = sorted.map((player) => `<li><span class="score-name">${escapeHtml(player.name)}${player.wins ? ` <small>(${player.wins}W)</small>` : ""}</span><strong class="score-value">${player.score > 0 ? "+" : ""}${player.score}</strong></li>`).join("");
}

function setIntroMessage(message) { el("introMessage").textContent = message; }
function showSetupMessage() { setIntroMessage("Chua cau hinh Firebase. Xem huong dan trong README de ket noi phong realtime."); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function copyLink() { navigator.clipboard.writeText(location.href).then(() => { el("copyLink").textContent = "Da copy link"; window.setTimeout(() => { el("copyLink").textContent = "Copy link"; }, 1800); }); }

function initialise() {
  if (!isFirebaseConfigured) el("firebaseWarning").classList.remove("hidden");
  if (state.roomCode) {
    el("formTitle").textContent = `Vao phong ${state.roomCode}`;
    el("playerCountWrap").classList.add("hidden"); el("createButton").classList.add("hidden"); el("joinButton").classList.remove("hidden");
    if (isFirebaseConfigured) onValue(ref(db, `rooms/${state.roomCode}`), (snapshot) => renderRoom(snapshot.val()));
  }
}

el("createForm").addEventListener("submit", createRoom);
el("joinButton").addEventListener("click", joinRoom);
el("startButton").addEventListener("click", startRoom);
el("copyLink").addEventListener("click", copyLink);
el("resetButton").addEventListener("click", () => { location.hash = ""; location.reload(); });
initialise();
