// ============================================================
// FOOTBALL STEPH - MOTORE PORTALE TORNEO (app.js)
// ============================================================

let scheduleData = { rounds: [] };
let matchesData = [];
let teamsData = [];
let playersData = [];
let currentTournamentId = null;

// Scala conversione voti in lettere -> valore numerico OVR
const GRADE_VALUES = {
  "A+": 99, "A": 92, "A-": 87,
  "B+": 82, "B": 77, "B-": 72,
  "C+": 67, "C": 62, "C-": 55
};

// Pesi specifici per calcolo OVR in base al ruolo
const ROLE_WEIGHTS = {
  POR: { tuf: 0.22, rif: 0.22, pia: 0.20, pre: 0.16, rin: 0.10, vel: 0.10 },
  DIF: { dif: 0.35, fis: 0.25, vel: 0.15, pas: 0.12, dri: 0.08, tir: 0.05 },
  CEN: { pas: 0.28, dri: 0.22, fis: 0.18, dif: 0.14, tir: 0.10, vel: 0.08 },
  ATT: { tir: 0.35, dri: 0.22, vel: 0.18, fis: 0.12, pas: 0.10, dif: 0.03 }
};

const STAT_LABELS_POR = [
  { id: "tuf", label: "TUF" },
  { id: "pre", label: "PRE" },
  { id: "rin", label: "RIN" },
  { id: "rif", label: "RIF" },
  { id: "vel", label: "VEL" },
  { id: "pia", label: "PIA" }
];

const STAT_LABELS_MOV = [
  { id: "vel", label: "VEL" },
  { id: "tir", label: "TIR" },
  { id: "pas", label: "PAS" },
  { id: "dri", label: "DRI" },
  { id: "dif", label: "DIF" },
  { id: "fis", label: "FIS" }
];

async function fetchFirstAvailable(paths) {
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
  }
  return null;
}

// ============================================================
// INIZIALIZZAZIONE (SINGOLO TORNEO DA SCHEDULED.JSON)
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  setupMainTabs();

  try {
    const [sched, matches, teams, players] = await Promise.all([
      fetchFirstAvailable(["data/scheduled.json", "data/schedule.json"]),
      fetchFirstAvailable(["data/match.json", "data/matches.json", "data/storico_partite.json", "data/storico_partite_2.json"]),
      fetchFirstAvailable(["data/teams.json", "data/squadre.json"]),
      fetchFirstAvailable(["data/player.json", "data/players.json", "data/database_giocatori.json", "data/database_youngCup.json"])
    ]);

    scheduleData = sched || { rounds: [] };
    matchesData = Array.isArray(matches) ? matches : [];
    teamsData = Array.isArray(teams) ? teams : [];
    playersData = Array.isArray(players) ? players : [];

    // Nasconde sempre eventuale selettore tornei nell'HTML
    const wrapper = document.getElementById("tournament-selector-wrapper");
    if (wrapper) wrapper.style.display = "none";

    // L'ID del torneo pubblico viene comandato da scheduled.json
    if (scheduleData && scheduleData.tournamentId && scheduleData.tournamentId.trim() !== "") {
      currentTournamentId = scheduleData.tournamentId.trim();
    } else {
      const firstTourMatch = matchesData.find(m => m.tournamentId && String(m.tournamentId).trim() !== "");
      currentTournamentId = firstTourMatch ? String(firstTourMatch.tournamentId).trim() : null;
    }

    const titleEl = document.getElementById("tournament-title");
    if (scheduleData && scheduleData.tournamentName) {
      titleEl.innerText = scheduleData.tournamentName;
    } else {
      titleEl.innerText = "FOOTBALL STEPH LEAGUE";
    }

    document.getElementById("loading-state").style.display = "none";
    document.getElementById("tab-classifica").style.display = "block";

    renderAll();
  } catch (err) {
    console.error("Errore nel caricamento dei dati JSON:", err);
    document.getElementById("loading-state").innerHTML = `
      <p style="color:#EF4444; font-weight:bold;">
        Errore nel caricamento dei file JSON dalla cartella data/.
      </p>
    `;
  }
});

function setupMainTabs() {
  const pills = document.querySelectorAll(".tab-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");

      const target = pill.getAttribute("data-tab");
      document.querySelectorAll(".tab-section").forEach(sec => {
        sec.style.display = sec.id === `tab-${target}` ? "block" : "none";
      });
    });
  });
}

function renderAll() {
  renderLeagueTable();
  renderMatchesAndSchedule();
  renderScorers();
  renderTeams();
}

// ============================================================
// HELPER DATI: GIOCATORI, OVR, COLORI & FILTRO PARTITE TORNEO
// ============================================================
function getPlayerFromDb(playerId, fallbackName = "Giocatore", fallbackIsGK = false) {
  const found = playersData.find(p => String(p.id) === String(playerId));
  if (found) return found;
  return {
    id: String(playerId || ""),
    name: fallbackName,
    role: fallbackIsGK ? "POR" : "CEN",
    stats: {}
  };
}

function computeOVR(player) {
  if (!player || !player.stats || Object.keys(player.stats).length === 0) return 70;
  const role = player.role || "CEN";
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.CEN;

  let sum = 0;
  let totalWeight = 0;

  for (const [statKey, weight] of Object.entries(weights)) {
    const grade = player.stats[statKey] || "B";
    const numericVal = GRADE_VALUES[grade] || 75;
    sum += numericVal * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(sum / totalWeight) : 70;
}

function getTierInfo(ovr) {
  if (ovr >= 80) return { cls: "tier-gold", label: "GOLD", emoji: "🥇" };
  if (ovr >= 70) return { cls: "tier-silver", label: "SILVER", emoji: "🥈" };
  return { cls: "tier-bronze", label: "BRONZE", emoji: "🥉" };
}

function colorValToHex(colorValue) {
  if (!colorValue) return "#3B82F6";
  let hex = Number(colorValue).toString(16).toUpperCase();
  if (hex.length > 6) hex = hex.substring(hex.length - 6);
  return `#${hex.padStart(6, "0")}`;
}

function findTeamColorHex(teamName, fallbackColorValue) {
  const t = teamsData.find(x => x.name.trim().toLowerCase() === String(teamName).trim().toLowerCase());
  if (t && t.colorValue) return colorValToHex(t.colorValue);
  if (fallbackColorValue) return colorValToHex(fallbackColorValue);
  return "#3B82F6";
}

function getTeamColorDot(teamName, fallbackColorValue) {
  const hex = findTeamColorHex(teamName, fallbackColorValue).toUpperCase();
  if (hex === "#EAB308") return "🟡";
  if (hex === "#EF4444") return "🔴";
  if (hex === "#3B82F6") return "🔵";
  if (hex === "#F8FAFC") return "⚪";
  if (hex === "#8B5CF6") return "🟣";
  if (hex === "#10B981") return "🟢";
  if (hex === "#F97316") return "🟠";
  if (hex === "#1E293B") return "⚫";
  return `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${hex}; vertical-align:middle;"></span>`;
}

// Filtra rigorosamente le partite del singolo torneo (esclude null e altri tornei)
function getTournamentMatches() {
  if (!currentTournamentId) return [];
  return matchesData.filter(m => m.tournamentId && String(m.tournamentId).trim() === currentTournamentId);
}

// ============================================================
// ALGORITMO CALCOLO PAGELLINI & MVP
// ============================================================
function calculateMatchRatings(m) {
  const ratings = {};
  const homeTotal = (m.homeScore || 0) + (m.homePenalties || 0);
  const awayTotal = (m.awayScore || 0) + (m.awayPenalties || 0);
  const hWon = homeTotal > awayTotal;
  const aWon = awayTotal > homeTotal;

  let maxScore = 0.0;
  let currentMvp = null;
  let isDrawMvp = false;

  ["home", "away"].forEach(team => {
    const teamWon = team === "home" ? hWon : aWon;
    const teamLost = team === "home" ? aWon : hWon;
    const list = team === "home" ? (m.homeRoster || []) : (m.awayRoster || []);

    list.forEach(p => {
      const playerId = String(p.dbId);
      let goals = 0, assists = 0, fouls = 0, yellows = 0, reds = 0,
          penSaved = 0, penMissed = 0, ownGoals = 0, goalsConceded = 0,
          errors = 0, bigMisses = 0, bigCreated = 0, goodPlays = 0;

      (m.events || []).forEach(e => {
        if (e.isPenalty) return; // Ignora la lotteria dei rigori finale

        if (String(e.playerId) === playerId) {
          if (e.type === "GOL" || e.type === "RIGORE_SEGNATO") goals++;
          if (e.type === "AUTOGOL") ownGoals++;
          if (e.type === "FALLO") fouls++;
          if (e.type === "GIALLO") yellows++;
          if (e.type === "ROSSO") reds++;
          if (e.type === "RIGORE_PARATO") penSaved++;
          if (e.type === "RIGORE_SBAGLIATO") penMissed++;
          if (e.type === "ERRORE") errors++;
          if (e.type === "BIG_CHANCE_MISSED") bigMisses++;
          if (e.type === "BIG_CHANCE_CREATED") bigCreated++;
          if (e.type === "BUONA_GIOCATA") goodPlays++;
        }

        if (e.type === "GOL" && e.sub && e.sub.includes(`Assist: #${p.num} ${p.name}`)) {
          assists++;
        }

        if ((e.type === "GOL" || e.type === "RIGORE_SEGNATO" || e.type === "AUTOGOL") && String(e.gkConcededId) === playerId) {
          goalsConceded++;
        }
      });

      const hasAction = (goals > 0 || assists > 0 || yellows > 0 || reds > 0 || penSaved > 0 || penMissed > 0 || ownGoals > 0 || goalsConceded > 0);
      const playedEnough = (p.playedSeconds || 0) >= 300;

      // Assegnazione SV se meno di 5 minuti (300s) e nessuna azione principale
      if (!hasAction && !playedEnough) {
        ratings[playerId] = "SV";
        return;
      }

      let score = 6.0;
      if (teamWon) score += 0.2;
      else if (teamLost) score -= 0.1;

      if (goals > 0) score += (goals * 1.0);
      if (assists > 0) score += (assists * 0.5);
      if (penSaved > 0) score += (penSaved * 1.2);
      if (penMissed > 0) score -= (penMissed * 0.8);
      if (ownGoals > 0) score -= (ownGoals * 1.0);
      if (yellows > 0) score -= (yellows * 0.5);
      if (reds > 0) score -= (reds * 1.0);
      if (bigCreated > 0) score += (bigCreated * 0.4);
      if (goodPlays > 0) score += (goodPlays * 0.1);
      if (fouls > 0) score -= (fouls * 0.2);
      if (goalsConceded > 0) score -= (goalsConceded * 0.1);
      if ((p.gkPlayedSeconds || 0) >= 900 && goalsConceded === 0) score += 1.0;
      if (errors > 0) score -= (errors * 0.1);
      if (bigMisses > 0) score -= (bigMisses * 0.4);

      score = Math.min(9.9, Math.max(1.0, score));
      const roundedScore = Number(score.toFixed(1));
      ratings[playerId] = roundedScore;

      const pData = {
        id: playerId,
        numScore: score,
        isWinner: teamWon,
        goals: goals,
        assists: assists,
        bigCreated: bigCreated,
        malusCount: fouls + errors + (yellows * 2) + (reds * 4),
        playedSeconds: p.playedSeconds || 0
      };

      // Logica Tie-Breaker MVP identica a Flutter
      if (score > maxScore) {
        maxScore = score;
        currentMvp = pData;
        isDrawMvp = false;
      } else if (score === maxScore && currentMvp !== null) {
        if (pData.isWinner && !currentMvp.isWinner) {
          currentMvp = pData;
          isDrawMvp = false;
        } else if (pData.isWinner === currentMvp.isWinner) {
          if (pData.goals > currentMvp.goals) {
            currentMvp = pData;
            isDrawMvp = false;
          } else if (pData.goals === currentMvp.goals) {
            if (pData.assists > currentMvp.assists) {
              currentMvp = pData;
              isDrawMvp = false;
            } else if (pData.assists === currentMvp.assists) {
              if (pData.bigCreated > currentMvp.bigCreated) {
                currentMvp = pData;
                isDrawMvp = false;
              } else if (pData.malusCount < currentMvp.malusCount) {
                currentMvp = pData;
                isDrawMvp = false;
              } else if (pData.playedSeconds > currentMvp.playedSeconds) {
                currentMvp = pData;
                isDrawMvp = false;
              } else {
                isDrawMvp = true;
              }
            }
          }
        }
      }
    });
  });

  const mvpId = (currentMvp !== null && !isDrawMvp) ? currentMvp.id : null;
  return { ratings, mvpId };
}

// ============================================================
// 1. TAB CLASSIFICA (SOLO SQUADRE DI TEAMS.JSON + PARTITE TORNEO)
// ============================================================
function renderLeagueTable() {
  const tbody = document.getElementById("league-table-body");
  tbody.innerHTML = "";

  const tourMatches = getTournamentMatches();
  const stats = {};

  // Inizializza le squadre ufficiali da teams.json
  teamsData.forEach(t => {
    stats[t.name] = {
      name: t.name,
      colorValue: t.colorValue,
      pt: 0, g: 0, v: 0, n: 0, s: 0, gf: 0, gs: 0, dr: 0
    };
  });

  // Aggiorna i dati con i match giocati nel torneo
  tourMatches.forEach(m => {
    if (!stats[m.homeName]) {
      stats[m.homeName] = { name: m.homeName, colorValue: m.homeColorValue, pt: 0, g: 0, v: 0, n: 0, s: 0, gf: 0, gs: 0, dr: 0 };
    }
    if (!stats[m.awayName]) {
      stats[m.awayName] = { name: m.awayName, colorValue: m.awayColorValue, pt: 0, g: 0, v: 0, n: 0, s: 0, gf: 0, gs: 0, dr: 0 };
    }

    const h = stats[m.homeName];
    const a = stats[m.awayName];

    h.g++;
    a.g++;
    h.gf += m.homeScore;
    h.gs += m.awayScore;
    a.gf += m.awayScore;
    a.gs += m.homeScore;

    if (m.homeScore > m.awayScore) {
      h.v++; h.pt += 3; a.s++;
    } else if (m.homeScore < m.awayScore) {
      a.v++; a.pt += 3; h.s++;
    } else {
      h.n++; h.pt += 1;
      a.n++; a.pt += 1;
    }
  });

  Object.values(stats).forEach(s => {
    s.dr = s.gf - s.gs;
  });

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.pt !== a.pt) return b.pt - a.pt;
    if (b.dr !== a.dr) return b.dr - a.dr;
    if (b.gf !== a.gf) return b.gf - a.gf;

    // Scontro Diretto
    const h2h = tourMatches.filter(m =>
      (m.homeName === a.name && m.awayName === b.name) ||
      (m.homeName === b.name && m.awayName === a.name)
    );
    let ptsA = 0, ptsB = 0;
    h2h.forEach(m => {
      if (m.homeName === a.name) {
        if (m.homeScore > m.awayScore) ptsA += 3;
        else if (m.homeScore < m.awayScore) ptsB += 3;
        else { ptsA++; ptsB++; }
      } else {
        if (m.homeScore > m.awayScore) ptsB += 3;
        else if (m.homeScore < m.awayScore) ptsA += 3;
        else { ptsA++; ptsB++; }
      }
    });
    if (ptsB !== ptsA) return ptsB - ptsA;

    return a.name.localeCompare(b.name);
  });

  sorted.forEach((row, idx) => {
    const hex = findTeamColorHex(row.name, row.colorValue);
    const drColor = row.dr > 0 ? "#10B981" : (row.dr < 0 ? "#EF4444" : "#94A3B8");
    const drText = row.dr > 0 ? `+${row.dr}` : `${row.dr}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-pos">${idx + 1}</td>
      <td class="col-team">
        <div class="team-cell">
          <span class="color-bar" style="background:${hex};"></span>
          <span>${row.name}</span>
        </div>
      </td>
      <td class="col-pt">${row.pt}</td>
      <td>${row.g}</td>
      <td>${row.v}</td>
      <td>${row.n}</td>
      <td>${row.s}</td>
      <td>${row.gf}</td>
      <td>${row.gs}</td>
      <td style="color:${drColor}; font-weight:700;">${drText}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================
// 2. TAB CALENDARIO
// ============================================================
function renderMatchesAndSchedule() {
  const container = document.getElementById("matches-container");
  container.innerHTML = "";

  const playedPool = [...getTournamentMatches()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  if (scheduleData && Array.isArray(scheduleData.rounds) && scheduleData.rounds.length > 0) {
    scheduleData.rounds.forEach(round => {
      const roundBlock = document.createElement("div");
      roundBlock.className = "round-block";
      roundBlock.innerHTML = `
        <div class="round-header">
          <span class="round-badge">📅 ${round.roundName}</span>
        </div>
      `;

      (round.matches || []).forEach(sched => {
        const matchIdx = playedPool.findIndex(m =>
          m.homeName.trim().toLowerCase() === sched.homeName.trim().toLowerCase() &&
          m.awayName.trim().toLowerCase() === sched.awayName.trim().toLowerCase()
        );

        let matchObj = null;
        if (matchIdx !== -1) {
          matchObj = playedPool[matchIdx];
          playedPool.splice(matchIdx, 1);
        }

        const card = buildMatchCard(sched, matchObj);
        roundBlock.appendChild(card);
      });

      container.appendChild(roundBlock);
    });
  }

  if (playedPool.length > 0) {
    const extraBlock = document.createElement("div");
    extraBlock.className = "round-block";
    extraBlock.innerHTML = `
      <div class="round-header">
        <span class="round-badge">⚽ Altre Partite Torneo</span>
      </div>
    `;

    playedPool.reverse().forEach(m => {
      const card = buildMatchCard(null, m);
      extraBlock.appendChild(card);
    });

    container.appendChild(extraBlock);
  }
}

function buildMatchCard(sched, matchObj) {
  const isPlayed = matchObj !== null;
  const homeName = isPlayed ? matchObj.homeName : sched.homeName;
  const awayName = isPlayed ? matchObj.awayName : sched.awayName;

  const homeDot = getTeamColorDot(homeName, isPlayed ? matchObj.homeColorValue : null);
  const awayDot = getTeamColorDot(awayName, isPlayed ? matchObj.awayColorValue : null);

  const card = document.createElement("div");
  card.className = "match-card";

  if (isPlayed) {
    const hasPens = (matchObj.homePenalties || 0) > 0 || (matchObj.awayPenalties || 0) > 0;
    const dateLabel = matchObj.date || (sched ? sched.scheduledDate : "");

    card.innerHTML = `
      <div class="match-meta-row">
        <span>🗓️ ${dateLabel}</span>
        <span class="status-pill status-played">FINALE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home">${homeName} ${homeDot}</div>
        <div class="match-center-score">
          <span class="score-text">${matchObj.homeScore} - ${matchObj.awayScore}</span>
          ${hasPens ? `<span class="penalties-sub">(${matchObj.homePenalties}-${matchObj.awayPenalties} dcr)</span>` : ""}
        </div>
        <div class="match-team-away">${awayDot} ${awayName}</div>
      </div>
      ${sched && sched.locationName ? `<div class="match-location-sub">📍 ${sched.locationName}</div>` : ""}
    `;
    card.onclick = () => openPlayedMatchModal(matchObj, sched);
  } else {
    card.innerHTML = `
      <div class="match-meta-row">
        <span>🕒 ${sched.scheduledDate || "Data da definire"}</span>
        <span class="status-pill status-scheduled">DA GIOCARE</span>
      </div>
      <div class="match-score-row">
        <div class="match-team-home">${homeName} ${homeDot}</div>
        <div class="match-center-score">
          <span class="score-dash">- : -</span>
        </div>
        <div class="match-team-away">${awayDot} ${awayName}</div>
      </div>
      ${sched.locationName ? `<div class="match-location-sub">📍 ${sched.locationName}</div>` : ""}
    `;
    card.onclick = () => openScheduledMatchModal(sched);
  }

  return card;
}

// ============================================================
// MODALE DETTAGLIO PARTITA
// ============================================================
function openScheduledMatchModal(sched) {
  document.getElementById("modal-match-meta").innerText = "GARA IN PROGRAMMA";
  const homeDot = getTeamColorDot(sched.homeName, null);
  const awayDot = getTeamColorDot(sched.awayName, null);

  document.getElementById("modal-score-box").innerHTML = `
    <div class="match-score-row">
      <div class="match-team-home">${sched.homeName} ${homeDot}</div>
      <div class="match-center-score"><span class="score-dash">- : -</span></div>
      <div class="match-team-away">${awayDot} ${sched.awayName}</div>
    </div>
  `;

  const schedView = document.getElementById("modal-scheduled-view");
  schedView.style.display = "block";
  document.getElementById("modal-played-view").style.display = "none";

  schedView.innerHTML = `
    <div style="background:#1E293B; border:1px solid #334155; border-radius:14px; padding:18px; text-align:center;">
      <div style="font-size:28px; margin-bottom:6px;">⏳</div>
      <h3 style="font-size:15px; font-weight:900; margin-bottom:6px;">Partita ancora da disputare</h3>
      <p style="color:#E2E8F0; font-size:13px; font-weight:700; margin-bottom:6px;">
        🗓️ ${sched.scheduledDate || "Data e ora da definire"}
      </p>
      <p style="color:#94A3B8; font-size:12px;">
        📍 ${sched.locationName || "Luogo da definire"}
      </p>
      ${sched.mapsUrl ? `<a href="${sched.mapsUrl}" target="_blank" rel="noopener" class="maps-btn">📍 Apri Posizione su Maps</a>` : ""}
    </div>
  `;

  document.getElementById("match-modal").style.display = "flex";
}

function openPlayedMatchModal(m, sched) {
  document.getElementById("modal-match-meta").innerText = `TABELLINO GARA • ${m.date || ""}`;
  const homeDot = getTeamColorDot(m.homeName, m.homeColorValue);
  const awayDot = getTeamColorDot(m.awayName, m.awayColorValue);
  const hasPens = (m.homePenalties || 0) > 0 || (m.awayPenalties || 0) > 0;

  document.getElementById("modal-score-box").innerHTML = `
    <div class="match-score-row">
      <div class="match-team-home">${m.homeName} ${homeDot}</div>
      <div class="match-center-score">
        <span class="score-text">${m.homeScore} - ${m.awayScore}</span>
        ${hasPens ? `<span class="penalties-sub">(${m.homePenalties}-${m.awayPenalties} dcr)</span>` : ""}
      </div>
      <div class="match-team-away">${awayDot} ${m.awayName}</div>
    </div>
    ${sched && sched.locationName ? `<div class="match-location-sub" style="margin-top:8px;">📍 ${sched.locationName}</div>` : ""}
  `;

  document.getElementById("modal-scheduled-view").style.display = "none";
  // Importante: usa "flex" per mantenere lo scroll interno funzionante!
  document.getElementById("modal-played-view").style.display = "flex";

  renderMatchCronaca(m);
  renderMatchPagelle(m);

  switchMatchModalTab("cronaca");
  document.getElementById("match-modal").style.display = "flex";
}

function switchMatchModalTab(tabName) {
  const btnC = document.getElementById("btn-tab-cronaca");
  const btnP = document.getElementById("btn-tab-pagelle");
  const bodyC = document.getElementById("modal-tab-cronaca");
  const bodyP = document.getElementById("modal-tab-pagelle");

  if (tabName === "cronaca") {
    btnC.classList.add("active");
    btnP.classList.remove("active");
    bodyC.style.display = "block";
    bodyP.style.display = "none";
  } else {
    btnP.classList.add("active");
    btnC.classList.remove("active");
    bodyP.style.display = "block";
    bodyC.style.display = "none";
  }
}

function getEventPeriodLabel(e) {
  const min = String(e.minute || "").toUpperCase();
  if (min.includes("RIGORI") || e.isPenalty) return "SEQUENZA CALCI DI RIGORE";
  if (min.includes("2°TS")) return "2° TEMPO SUPPLEMENTARE";
  if (min.includes("1°TS")) return "1° TEMPO SUPPLEMENTARE";
  if (min.includes("2° T")) return "2° TEMPO";
  return "1° TEMPO";
}

function renderMatchCronaca(m) {
  const container = document.getElementById("modal-tab-cronaca");
  container.innerHTML = "";

  const salienti = ["GOL", "RIGORE_SEGNATO", "RIGORE_SBAGLIATO", "AUTOGOL", "GIALLO", "ROSSO", "SOSTITUZIONE"];
  const rawEvents = (m.events || []).filter(e => salienti.includes(e.type));

  if (rawEvents.length === 0) {
    container.innerHTML = `<p style="color:#94A3B8; text-align:center; padding:24px; font-size:12px;">Nessuna azione saliente registrata.</p>`;
    return;
  }

  const chronological = rawEvents.slice().reverse();
  let lastPeriod = "";
  let homePenCount = 0;
  let awayPenCount = 0;

  chronological.forEach(e => {
    const period = getEventPeriodLabel(e);
    if (period !== "" && period !== lastPeriod) {
      lastPeriod = period;
      const div = document.createElement("div");
      div.className = "period-divider";
      div.innerHTML = `<hr/><span>${period}</span><hr/>`;
      container.appendChild(div);
    }

    const sideClass = e.team === "home" ? "home" : (e.team === "away" ? "away" : "");
    const row = document.createElement("div");
    row.className = `event-row ${sideClass}`;

    // Badge: numero progressivo per squadra nei rigori, altrimenti solo MM:SS
    let badgeText = "";
    if (e.isPenalty || period === "CALCI DI RIGORE") {
      if (e.team === "home") {
        homePenCount++;
        badgeText = `${homePenCount}`;
      } else {
        awayPenCount++;
        badgeText = `${awayPenCount}`;
      }
    } else {
      badgeText = String(e.minute || "")
        .replace(/^(1°TS|2°TS|1°\s*T(empo)?|2°\s*T(empo)?)\s*/i, "")
        .trim();
    }

    // Rimuove "Squadra: NomeSquadra" lasciando solo Assist o info sostituzione
    const cleanSub = String(e.sub || "")
      .replace(/Squadra:\s*[^•\n]+(•\s*)?/gi, "")
      .trim();

    row.innerHTML = `
      <span class="minute-badge">${badgeText}</span>
      <div style="font-size:12px; line-height:1.35;">
        <div style="font-weight:800; color:#FFFFFF;">${e.title || ""}</div>
        ${cleanSub ? `<div style="font-size:10px; color:#94A3B8;">${cleanSub}</div>` : ""}
      </div>
    `;
    container.appendChild(row);
  });
}

function renderMatchPagelle(m) {
  const container = document.getElementById("modal-tab-pagelle");
  container.innerHTML = "";

  const { ratings, mvpId } = calculateMatchRatings(m);

  const buildTeamBox = (teamName, roster, colorVal, emojiPrefix) => {
    const hex = findTeamColorHex(teamName, colorVal);
    const box = document.createElement("div");
    box.style = "background:#111827; border:1px solid #1E293B; border-radius:12px; padding:12px; margin-bottom:12px;";

    let sum = 0, count = 0;
    (roster || []).forEach(p => {
      const v = ratings[String(p.dbId)];
      if (typeof v === "number" && v > 0) {
        sum += v;
        count++;
      }
    });
    const avgStr = count > 0 ? (sum / count).toFixed(1) : "N.D.";

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #1E293B; padding-bottom:8px;">
        <span style="color:${hex}; font-weight:900; font-size:13px;">${emojiPrefix} ${teamName}</span>
        <span class="team-avg-badge">⭐ ${avgStr}</span>
      </div>
    `;

    (roster || []).forEach(p => {
      const dbP = getPlayerFromDb(p.dbId, p.name, p.isGK);
      const role = p.isGK ? "POR" : (dbP.role || "CEN");
      const vote = ratings[String(p.dbId)] ?? "SV";
      const isSV = vote === "SV";
      const isMvp = !isSV && String(p.dbId) === String(mvpId);

      let badgeColor = "#334155"; // Grigio per SV
      if (isMvp) {
        badgeColor = "#0044FF";
      } else if (!isSV) {
        if (vote >= 6.8) badgeColor = "#0A7227";
        else if (vote >= 5.8) badgeColor = "#D97706";
        else badgeColor = "#D50000";
      }

      html += `
        <div class="pagella-row">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="role-badge role-${role}">${role}</span>
            <span style="font-size:12px; font-weight:700; color:#F8FAFC;">#${p.num} ${p.name}</span>
            ${isMvp ? `<span class="mvp-tag">MVP</span>` : ""}
          </div>
          <span class="vote-badge" style="background:${badgeColor};">
            ${typeof vote === "number" ? vote.toFixed(1) : "SV"}
          </span>
        </div>
      `;
    });

    box.innerHTML = html;
    return box;
  };

  container.appendChild(buildTeamBox(m.homeName, m.homeRoster, m.homeColorValue, "🏠"));
  container.appendChild(buildTeamBox(m.awayName, m.awayRoster, m.awayColorValue, "🚗"));
}

function closeMatchModal() {
  document.getElementById("match-modal").style.display = "none";
}

// ============================================================
// 3. TAB MARCATORI (TUTTI I GIOCATORI DELLE SQUADRE DEL TORNEO)
// ============================================================
function renderScorers() {
  const tbody = document.getElementById("scorers-table-body");
  tbody.innerHTML = "";

  const tourMatches = getTournamentMatches();
  const scorersMap = {};

  const ensureEntry = (key, name, teamName) => {
    if (!scorersMap[key]) {
      scorersMap[key] = { id: key, name: name, team: teamName, gol: 0, assist: 0 };
    }
  };

  // 1. Pre-carica TUTTI i giocatori delle squadre iscritte (anche con 0 gol e 0 assist)
  teamsData.forEach(team => {
    (team.roster || []).forEach(entry => {
      const dbP = getPlayerFromDb(entry.playerId);
      if (dbP && dbP.id) {
        ensureEntry(String(dbP.id), dbP.name, team.name);
      }
    });
  });

  // 2. Somma Gol e Assist delle partite del torneo
  tourMatches.forEach(m => {
    const allMatchPlayers = [
      ...(m.homeRoster || []).map(p => ({ ...p, teamName: m.homeName })),
      ...(m.awayRoster || []).map(p => ({ ...p, teamName: m.awayName }))
    ];

    // Assicura che anche eventuali giocatori presenti in distinta ma non in teams.json siano registrati
    allMatchPlayers.forEach(mp => {
      ensureEntry(String(mp.dbId), mp.name, mp.teamName);
    });

    (m.events || []).forEach(e => {
      const teamName = e.team === "home" ? m.homeName : m.awayName;

      if (e.minute !== "RIGORI" && !e.isPenalty && (e.type === "GOL" || e.type === "RIGORE_SEGNATO")) {
        if (e.playerId) {
          const pInfo = allMatchPlayers.find(x => String(x.dbId) === String(e.playerId)) || getPlayerFromDb(e.playerId);
          const pName = pInfo ? pInfo.name : e.title.replace("⚽ GOL! ", "").replace(/#\d+\s*/, "").trim();
          ensureEntry(String(e.playerId), pName, teamName);
          scorersMap[String(e.playerId)].gol++;
        }
      }

      if (e.sub && e.sub.includes("Assist:")) {
        const rawAssist = e.sub.split("Assist:")[1].trim();
        const cleanAssistName = rawAssist.replace(/^#\d+\s*/, "").trim();

        const assistedPlayer = allMatchPlayers.find(
          x => x.name.toLowerCase() === cleanAssistName.toLowerCase() && x.teamName === teamName
        );
        const key = assistedPlayer ? String(assistedPlayer.dbId) : cleanAssistName;
        const finalName = assistedPlayer ? assistedPlayer.name : cleanAssistName;

        ensureEntry(key, finalName, teamName);
        scorersMap[key].assist++;
      }
    });
  });

  // Ordina: 1. Gol decrescente -> 2. Assist decrescente -> 3. Alfabetico
  const sorted = Object.values(scorersMap).sort((a, b) => {
    if (b.gol !== a.gol) return b.gol - a.gol;
    if (b.assist !== a.assist) return b.assist - a.assist;
    return a.name.localeCompare(b.name);
  });

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; color:#94A3B8;">Nessun giocatore registrato nel torneo.</td></tr>`;
    return;
  }

  sorted.forEach((sc, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-pos">${idx + 1}</td>
      <td class="col-team">
        <div style="font-weight:800; color:#FFFFFF; font-size:13px;">${sc.name}</div>
        <div style="font-size:10px; color:#94A3B8;">${sc.team}</div>
      </td>
      <td class="col-pt">${sc.gol}</td>
      <td class="col-ass">${sc.assist}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================
// 4. TAB SQUADRE (ORDINATE SOLO PER RUOLO POR->DIF->CEN->ATT E OVR)
// ============================================================
function renderTeams() {
  const container = document.getElementById("teams-container");
  container.innerHTML = "";

  const roleOrder = { POR: 0, DIF: 1, CEN: 2, ATT: 3 };

  teamsData.forEach(team => {
    const hex = colorValToHex(team.colorValue);
    const rawRoster = team.roster || [];

    const enrichedRoster = rawRoster.map((entry, idx) => {
      const dbP = getPlayerFromDb(entry.playerId, `Giocatore ${idx + 1}`);
      const ovr = computeOVR(dbP);
      return {
        id: dbP.id,
        name: dbP.name,
        role: dbP.role || "CEN",
        stats: dbP.stats || {},
        ovr: ovr,
        isStarter: entry.isStarter !== false,
        customNum: entry.customNum
      };
    });

    // Ordina TUTTI i giocatori esclusivamente per Ruolo (POR, DIF, CEN, ATT) e a parità di ruolo per OVR decrescente
    enrichedRoster.sort((a, b) => {
      const rA = roleOrder[a.role] ?? 99;
      const rB = roleOrder[b.role] ?? 99;
      if (rA !== rB) return rA - rB;
      return b.ovr - a.ovr;
    });

    enrichedRoster.forEach((p, idx) => {
      p.shirtNum = (p.customNum && String(p.customNum).trim() !== "") ? String(p.customNum).trim() : String(idx + 1);
    });

    const avgOvr = enrichedRoster.length > 0
      ? (enrichedRoster.reduce((acc, p) => acc + p.ovr, 0) / enrichedRoster.length).toFixed(1)
      : "--";

    const accordion = document.createElement("div");
    accordion.className = "team-accordion";

    const header = document.createElement("div");
    header.className = "team-acc-header";
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="color-bar" style="background:${hex}; width:10px; height:32px; border-radius:4px;"></span>
        <div>
          <div style="font-size:15px; font-weight:900; color:#FFFFFF;">${team.name}</div>
          <div style="font-size:11px; color:#94A3B8;">${enrichedRoster.length} Giocatori in rosa</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="background:#0F172A; border:1px solid #1E293B; color:#10B981; font-weight:900; font-size:12px; padding:4px 8px; border-radius:6px;">
          OVR ${avgOvr}
        </span>
        <span class="acc-arrow" style="font-size:12px; color:#94A3B8;">▼</span>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "team-acc-body";
    body.style.display = "none";

    enrichedRoster.forEach(p => {
      const tier = getTierInfo(p.ovr);
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="role-badge role-${p.role}">${p.role}</span>
          <span style="font-size:11px; color:#94A3B8; font-weight:800; width:26px;">#${p.shirtNum}</span>
          <span style="font-size:13px; font-weight:700; color:#FFFFFF;">${p.name}</span>
        </div>
        <span class="ovr-pill ${tier.cls}">${p.ovr}</span>
      `;
      row.onclick = () => openPlayerModal(p, team.name);
      body.appendChild(row);
    });

    header.onclick = () => {
      const isOpen = body.style.display === "block";
      body.style.display = isOpen ? "none" : "block";
      header.querySelector(".acc-arrow").innerText = isOpen ? "▼" : "▲";
    };

    accordion.appendChild(header);
    accordion.appendChild(body);
    container.appendChild(accordion);
  });
}

// ============================================================
// MODALE SCHEDA ATLETA (CON AMMONIZIONI / ESPULSIONI E TESTI BIANCHI)
// ============================================================
function openPlayerModal(player, teamName) {
  const tier = getTierInfo(player.ovr);
  const statDefs = player.role === "POR" ? STAT_LABELS_POR : STAT_LABELS_MOV;

  const attributesHtml = statDefs.map(def => {
    const grade = (player.stats && player.stats[def.id]) ? player.stats[def.id] : "B";
    return `
      <div class="stat-item" style="background:#1E293B; border:1px solid #334155;">
        <span style="color:#94A3B8; font-weight:700;">${def.label}</span>
        <strong style="color:#10B981; font-size:13px;">${grade}</strong>
      </div>
    `;
  }).join("");

  const tourMatches = getTournamentMatches();
  let presenze = 0, gol = 0, assist = 0, gialli = 0, rossi = 0, mvpCount = 0, sumVoti = 0, countVoti = 0;

  tourMatches.forEach(m => {
    const inMatch = [...(m.homeRoster || []), ...(m.awayRoster || [])].some(
      x => String(x.dbId) === String(player.id)
    );
    if (inMatch) {
      const { ratings, mvpId } = calculateMatchRatings(m);
      const v = ratings[String(player.id)];

      // Conta la presenza SOLO se il giocatore ha preso voto numerico (NON è "SV")
      if (typeof v === "number") {
        presenze++;
        sumVoti += v;
        countVoti++;
        if (String(mvpId) === String(player.id)) mvpCount++;
      }
    }

    (m.events || []).forEach(e => {
      if (String(e.playerId) === String(player.id)) {
        if (e.minute !== "RIGORI" && !e.isPenalty && (e.type === "GOL" || e.type === "RIGORE_SEGNATO")) {
          gol++;
        } else if (e.type === "GIALLO") {
          gialli++;
        } else if (e.type === "ROSSO") {
          rossi++;
        }
      }
      if (e.sub && e.sub.includes("Assist:") && e.sub.includes(player.name)) {
        assist++;
      }
    });
  });

  const mediaVoto = countVoti > 0 ? (sumVoti / countVoti).toFixed(2) : "--";

  const content = document.getElementById("player-card-content");
  content.innerHTML = `
    <div style="text-align:center; padding:18px; border-radius:16px; margin-bottom:14px;" class="${tier.cls}">
      <div style="font-size:11px; font-weight:900; letter-spacing:1px;">${tier.emoji} ${tier.label} CARD</div>
      <div style="font-size:34px; font-weight:900; line-height:1.1; margin:4px 0;">${player.ovr}</div>
      <div style="font-size:18px; font-weight:900;">#${player.shirtNum} ${player.name}</div>
      <div style="font-size:12px; font-weight:800; opacity:0.85; margin-top:2px;">${player.role} • ${teamName}</div>
    </div>

    <div style="font-size:11px; font-weight:900; color:#94A3B8; margin-bottom:6px; letter-spacing:0.5px;">
      ATTRIBUTI ATLETA
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-top:0; margin-bottom:14px;">
      ${attributesHtml}
    </div>

    <div style="font-size:11px; font-weight:900; color:#94A3B8; margin-bottom:6px; letter-spacing:0.5px;">
      RENDIMENTO NEL TORNEO
    </div>
    <div class="stats-grid" style="margin-top:0;">
      <div class="stat-item"><span>Presenze:</span><strong style="color:#FFFFFF;">${presenze}</strong></div>
      <div class="stat-item"><span>Media Voto:</span><strong style="color:#FFFFFF;">⭐ ${mediaVoto}</strong></div>
      <div class="stat-item"><span>Gol:</span><strong style="color:#FFFFFF;">⚽ ${gol}</strong></div>
      <div class="stat-item"><span>Assist:</span><strong style="color:#FFFFFF;">🅰️ ${assist}</strong></div>
      <div class="stat-item"><span>Ammonizioni:</span><strong style="color:#FFFFFF;">🟨 ${gialli}</strong></div>
      <div class="stat-item"><span>Espulsioni:</span><strong style="color:#FFFFFF;">🟥 ${rossi}</strong></div>
      <div class="stat-item" style="grid-column: span 2;"><span>Premi MVP:</span><strong style="color:#F59E0B;">🏆 ${mvpCount}</strong></div>
    </div>
  `;

  document.getElementById("player-modal").style.display = "flex";
}

function closePlayerModal() {
  document.getElementById("player-modal").style.display = "none";
}

window.onclick = function(event) {
  const mModal = document.getElementById("match-modal");
  const pModal = document.getElementById("player-modal");
  if (event.target === mModal) mModal.style.display = "none";
  if (event.target === pModal) pModal.style.display = "none";
};
