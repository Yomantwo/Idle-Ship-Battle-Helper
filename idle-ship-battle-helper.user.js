// ==UserScript==
// @name         Idle Ship Battle - Helper
// @namespace    local.idleship.autobuy
// @version      1.1.0
// @description  Achète armes et nœuds de prestige au meilleur rendement, à partir des formules exactes du jeu (décompilées). Aucune requête de lecture : écoute les réponses que le jeu reçoit déjà.
// @match        https://idleshipbattle.myrialis.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* MODEL-BEGIN */
  // ─── Tables du jeu (IdleShipBattle.Core, protocole 22) ───────────────────────
  const E = { Origin: 0, Power: 1, Discount: 2, Loot: 3, Reserve: 4, HeadStart: 5, UnlockLaser: 6, UnlockMissile: 7,
    CannonPower: 8, CannonRate: 9, LaserPower: 10, LaserHeat: 11, MissilePower: 12, GlobalRate: 13, MultishotCap: 14,
    BeamCap: 15, SalvoCap: 16, AoeCap: 17, OfflineBoss: 18, BossBounty: 19, PrestigeGain: 20, BossPrestige: 21, ElitePrestige: 22 };

  // SkillTree.Nodes, dans l'ordre des id : [effet, montant (‰ ou unités), coût en prestige, taille, parents]
  const NODES = [
    [0,0,0,3,[]], [1,20,30,0,[0]], [1,20,50,0,[1]], [1,20,50,0,[1]], [6,0,300,2,[2]],
    [1,50,250,1,[2,3]], [1,20,400,0,[5]], [1,20,800,0,[6,25]], [1,60,2500,1,[28,29]], [3,30,30,0,[0]],
    [3,30,60,0,[9]], [2,20,60,0,[9]], [3,80,400,1,[13,23]], [2,20,150,0,[11]], [2,50,600,1,[16,81]],
    [5,500,150,0,[26]], [5,3000,800,1,[15]], [4,50,30,0,[0]], [4,50,50,0,[17]], [4,50,80,0,[18]],
    [7,0,2000,2,[3]], [4,50,120,1,[19,68]], [2,20,300,0,[27]], [3,30,150,0,[10]], [3,100,1500,1,[14]],
    [1,20,400,0,[5]], [5,300,100,0,[12]], [2,20,200,0,[12]], [1,20,1000,0,[7]], [1,40,2000,1,[7]],
    [4,50,200,0,[21]], [8,20,50,0,[2]], [8,20,100,0,[31]], [8,30,250,0,[32]], [9,10,100,0,[31]],
    [9,20,250,0,[34]], [8,60,800,1,[33,35]], [14,1,1500,2,[36]], [8,30,2000,0,[36]], [8,80,6000,1,[38]],
    [9,40,800,1,[36]], [9,20,2000,0,[40]], [9,50,6000,1,[39,41]], [14,1,8000,2,[42]], [10,20,100,0,[4]],
    [10,30,250,0,[44]], [11,30,100,0,[4]], [11,40,250,0,[46]], [10,60,800,1,[45,47]], [15,1,1500,2,[48]],
    [10,30,2000,0,[48]], [10,80,6000,1,[50]], [11,80,800,1,[48]], [11,40,2000,0,[52]], [11,100,6000,1,[51,53]],
    [15,1,8000,2,[54]], [12,30,200,0,[20]], [12,40,500,0,[56]], [17,4,3000,2,[20]], [12,80,1500,1,[57,58]],
    [16,1,3000,2,[59]], [12,40,4000,0,[59]], [17,4,15000,2,[59]], [12,100,12000,1,[61,62]], [16,1,15000,2,[63]],
    [13,30,2000,1,[8]], [1,100,15000,2,[65]], [18,50,30,0,[17]], [18,50,50,0,[67]], [18,50,80,0,[21]],
    [18,50,120,0,[69]], [18,50,200,1,[30,70]], [4,100,1000,0,[71]], [4,100,3000,1,[72]], [18,50,1000,0,[71]],
    [18,50,3000,0,[74]], [18,50,6000,0,[73,75]], [4,100,8000,0,[76]], [4,100,15000,1,[77]], [18,100,12000,1,[76]],
    [19,500,800,2,[12]], [19,250,1500,0,[22]], [19,500,3000,2,[24]], [20,30,100,0,[0]], [20,30,300,0,[83]],
    [20,40,800,0,[84]], [21,50,300,0,[83]], [21,50,800,0,[86]], [20,80,2500,1,[85,87]], [22,100,500,0,[88]],
    [20,50,6000,0,[88]], [21,100,6000,0,[88]], [21,150,15000,1,[90,91]], [22,200,3000,1,[92]],
  ];
  const NODE_COUNT = NODES.length;

  // Balance : pistes par arme, coût de base, croissance (‰ par niveau), pistes « demi-pas » (×√g par niveau)
  const TPS = 4;
  const TRACK_COUNT = [3, 3, 4];
  const BASE_COST = [[10, 17, 1000, 0], [500, 15000, 1800, 0], [1500, 2500, 2000, 50000]];
  const COST_GROWTH = [[2000, 2000, 6000, 2200], [2000, 3000, 1500, 1000], [2000, 2000, 1500, 3000]];
  const HALVED = [[1, 1, 0, 0], [1, 0, 1, 0], [1, 1, 1, 0]];
  const BASE_MAX = [[1000, 40, 7], [1000, 7, 60], [1000, 24, 20, 4]];
  const CAP_OF = [[0, 0, E.MultishotCap], [0, E.BeamCap, 0], [0, 0, E.AoeCap, E.SalvoCap]];
  const CAP = 2251799813685247n;

  function sums(nodes) {
    const s = new Array(23).fill(0);
    for (let i = 1; i < NODE_COUNT; i++) if (nodes[i]) s[NODES[i][0]] += NODES[i][1];
    return s;
  }
  function hasEffect(nodes, e) {
    for (let i = 1; i < NODE_COUNT; i++) if (nodes[i] && NODES[i][0] === e) return true;
    return false;
  }
  function unlockedOf(nodes) { return [true, hasEffect(nodes, E.UnlockLaser), hasEffect(nodes, E.UnlockMissile)]; }

  function isqrt(n) {
    let x = Math.floor(Math.sqrt(n));
    while (x * x > n) x--;
    while ((x + 1) * (x + 1) <= n) x++;
    return x;
  }

  // Balance.Grow : v ← v·g/1000, « times » fois, plafonné à 2^51−1
  function grow(v, g, times) {
    if (times > 0 && v <= CAP - 1n) {
      for (let i = 0; i < times; i++) {
        const m = v * g;
        v = m / 1000n;
        if (m >= CAP * 1000n) break;
      }
    }
    return v >= CAP ? CAP : v;
  }
  const costCache = new Map();
  // Balance.Cost(weapon, track, level) : prix du passage level → level+1, sans remise
  function baseCost(w, t, L) {
    const key = (w * 4 + t) * 4096 + L;
    let c = costCache.get(key);
    if (c !== undefined) return c;
    const g = BigInt(COST_GROWTH[w][t]);
    let v = BigInt(BASE_COST[w][t]);
    if (!HALVED[w][t]) v = grow(v, g, L);
    else {
      v = grow(v, g, Math.floor(L / 2));
      if (L & 1) {
        if (v > CAP - 1n) v = CAP;
        else {
          v = v * BigInt(isqrt(COST_GROWTH[w][t] * 1000)) / 1000n;
          if (v >= CAP) v = CAP;
        }
      }
    }
    c = Number(v);
    costCache.set(key, c);
    return c;
  }
  // Balance.Cost(Player, …) : remise Marchandage, plafonnée à 50 %
  function cost(w, t, L, S) {
    const c = baseCost(w, t, L);
    const k = 1000 - Math.min(500, S[E.Discount]);
    const r = Math.floor(c / 1000) * k + Math.floor((c % 1000) * k / 1000);
    return r <= 1 ? 1 : r;
  }
  function trackMax(w, t, S) { return BASE_MAX[w][t] + (CAP_OF[w][t] ? S[CAP_OF[w][t]] : 0); }

  // Balance.Apply : niveaux + nœuds → stats des armes
  function stats(lv, S) {
    const P = S[E.Power], G = S[E.GlobalRate];
    const scaled = (base, step, L, pw) => { const m = (step * L + base) * pw; return m < 1000 ? 1 : Math.floor(m / 1000); };
    const c = lv[0], l = lv[1], m = lv[2];
    return [
      { dmg: scaled(10, 5, c[0], 1000 + P + S[E.CannonPower]),
        rate: Math.min(8000, Math.floor((Math.min(c[1] * 25, 1000) + 250) * (1000 + S[E.CannonRate] + G) / 1000)),
        tgt: Math.min(c[2], 7 + S[E.MultishotCap]) + 1 },
      { dmg: scaled(2, 5, l[0], 1000 + P + G + S[E.LaserPower]), rate: 1000,
        tgt: Math.min(l[1], 7 + S[E.BeamCap]) + 1, heatMille: 1000 + S[E.LaserHeat], heatLv: Math.min(l[2], 60) },
      { dmg: scaled(20, 20, m[0], 1000 + P + S[E.MissilePower]),
        rate: Math.min(8000, Math.floor((Math.min(m[1] * 8, 188) + 62) * (1000 + G) / 1000)),
        aoe: Math.min(m[2], 20 + S[E.AoeCap]) * 5 + 40, tgt: Math.min(m[3], 4 + S[E.SalvoCap]) + 1 },
    ];
  }

  // DPS attendu (World.FireWeapons / FireLaser). env : factor (‰ de tir), drones sur le terrain,
  // heat (ticks moyens sur la même cible), density (drones par px², pour la zone des missiles).
  function dps(st, unl, env) {
    const f = env.factor / 1000, N = Math.max(1, env.drones);
    const per = [0, 0, 0];
    const c = st[0];
    per[0] = c.dmg * Math.min(c.tgt, N) * Math.min(8, c.rate * f / 1000) * TPS;
    if (unl[1]) {
      const l = st[1];
      let h = Math.min(env.heat, 40) * l.heatLv * 10;
      if (l.heatMille >= 1001) h = h * l.heatMille / 1000;
      h = Math.min(h, 1e6);
      per[1] = Math.max(1, l.dmg * f) * (Math.min(l.tgt, N) + h / 1000) * TPS;
    }
    if (unl[2]) {
      const m = st[2];
      const fill = Math.ceil(1000 / Math.max(1, m.rate * f));
      const cycle = fill + (m.tgt >= 2 ? m.tgt - 1 : 0);
      const hits = Math.min(N, 1 + env.density * Math.PI * m.aoe * m.aoe);
      per[2] = m.dmg * m.tgt * hits * TPS / cycle;
    }
    return { total: per[0] + per[1] + per[2], per };
  }

  // Répartition gloutonne d'un budget de crédits depuis zéro (ce que fait un run complet)
  function greedySpend(budget, S, unl, env) {
    const lv = [[0, 0, 0], [0, 0, 0], [0, 0, 0, 0]];
    let left = budget, d0 = dps(stats(lv, S), unl, env).total;
    for (let guard = 0; guard < 4000; guard++) {
      let best = null, bestR = 0;
      for (let w = 0; w < 3; w++) {
        if (!unl[w]) continue;
        for (let t = 0; t < TRACK_COUNT[w]; t++) {
          const L = lv[w][t];
          if (L >= trackMax(w, t, S)) continue;
          const c = cost(w, t, L, S);
          if (c > left) continue;
          lv[w][t]++;
          const d = dps(stats(lv, S), unl, env).total;
          lv[w][t]--;
          const r = (d - d0) / c;
          if (r > bestR) { bestR = r; best = [w, t, c, d]; }
        }
      }
      if (!best) break;
      lv[best[0]][best[1]]++;
      left -= best[2];
      d0 = best[3];
    }
    return { lv, dps: d0 };
  }

  // Prestige (Balance.PrestigeFor, BossPrestige, ElitePrestige, OfflineBossPrestige)
  function prestigeFor(spawned, S) {
    const s = Math.floor(spawned / 1000);
    const base = Math.floor(s * isqrt(isqrt(s * 100000000)) * 10 / 1200);
    return Math.floor((S[E.PrestigeGain] + 1000) * base / 1000);
  }

  // Prestige d'un run qui se termine à « s » drones, pour un joueur en ligne une fraction « u » du temps.
  // Version continue des formules ci-dessus (sans les arrondis), pour comparer des variations fines.
  function runPrestige(s, S, u, ticksPerDrone) {
    const k = s / 1000, B = s / 5000;
    const line = Math.pow(k, 1.25) * 1000 / 1200 * (1000 + S[E.PrestigeGain]) / 1000;
    const offMul = Math.min(1000, 250 + S[E.OfflineBoss]) / 1000;
    const boss = (5 * B * B + 35 * B) / 4 * (1000 + S[E.PrestigeGain] + S[E.BossPrestige]) / 1000 * (u + (1 - u) * offMul);
    const ticks = Math.max(1, s * ticksPerDrone);
    const elite = ticks / 2400 * Math.max(1, (5 * B + 40) / 4 * 0.2) * (1000 + S[E.PrestigeGain] + S[E.ElitePrestige]) / 1000 * u;
    return { total: line + boss + elite, line, boss, elite, ticks, rate: (line + boss + elite) / ticks };
  }
  /* MODEL-END */

  // ─── Réglages persistants ─────────────────────────────────────────────────────
  const LS_KEY = 'isbAutobuy';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } })();
  const cfg = Object.assign({
    autoWeapons: true,
    autoNodes: true,
    wPrestige: 1,       // poids du gain de prestige par heure dans le choix des nœuds
    wDamage: 1,         // poids du gain de dégâts
    eta: 0.5,           // élasticité de la longueur d'un run à la puissance de la flotte
    onlineManual: null, // null = fraction en ligne mesurée automatiquement
    collapsed: false,
  }, saved.cfg || {});
  const hist = Object.assign({ runs: [], act: { first: Date.now(), minutes: 0 } }, saved.hist || {});
  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify({ cfg, hist })); } catch (e) { } }

  // ─── État reconstitué depuis le réseau ────────────────────────────────────────
  const st = {
    ready: false, me: 0, version: null,
    levels: [[0, 0, 0], [0, 0, 0], [0, 0, 0, 0]], nodes: new Array(NODE_COUNT).fill(0),
    credits: 0, pp: 0, run: -1, spawned: 0, droneHp: 0, tick: 0, runStartTick: 0,
    share: 0.2, heat: 2, drones: 10, density: 2e-5,
    income: 0, kappa: 0, runEarned: 0, lastSync: null,
    busy: false, lastPost: 0, failUntil: 0,
    weaponPlan: null, nodePlan: null, nodePlanKey: '', nodePlanAt: 0,
    log: [],
  };
  function log(msg) {
    const t = new Date().toTimeString().slice(0, 8);
    st.log.unshift(t + ' ' + msg);
    st.log.length = Math.min(st.log.length, 8);
  }

  const WEAPON_NAMES = ['Canon', 'Laser', 'Missile'];
  const TRACK_NAMES = [['Dégâts', 'Cadence', 'Multitir'], ['Dégâts', 'Rayons', 'Chauffe'], ['Dégâts', 'Cadence', 'Zone', 'Salve']];
  function nodeLabel(i) {
    const [e, a] = NODES[i];
    const p = (a / 10).toLocaleString('fr-FR') + ' %';
    switch (e) {
      case E.Power: return 'Dégâts toutes armes +' + p;
      case E.Discount: return 'Coût des armes −' + p;
      case E.Loot: return 'Crédits +' + p;
      case E.Reserve: return 'Tir hors ligne +' + p;
      case E.HeadStart: return 'Départ +' + a + ' cr';
      case E.UnlockLaser: return 'Débloque le LASER';
      case E.UnlockMissile: return 'Débloque le MISSILE';
      case E.CannonPower: return 'Dégâts canon +' + p;
      case E.CannonRate: return 'Cadence canon +' + p;
      case E.LaserPower: return 'Dégâts laser +' + p;
      case E.LaserHeat: return 'Chauffe laser +' + p;
      case E.MissilePower: return 'Dégâts missile +' + p;
      case E.GlobalRate: return 'Cadence toutes armes +' + p;
      case E.MultishotCap: return 'Multitir +' + a + ' niv max';
      case E.BeamCap: return 'Rayons +' + a + ' niv max';
      case E.SalvoCap: return 'Salve +' + a + ' niv max';
      case E.AoeCap: return 'Zone +' + a + ' niv max';
      case E.OfflineBoss: return 'Prestige Colosse hors ligne +' + p;
      case E.BossBounty: return 'Prime du Colosse ' + p + ' PV';
      case E.PrestigeGain: return 'Prestige +' + p;
      case E.BossPrestige: return 'Prestige Colosse +' + p;
      case E.ElitePrestige: return 'Prestige élite +' + p;
      default: return 'Origine';
    }
  }
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (Math.abs(n) < 1000) return (Math.round(n * 10) / 10).toLocaleString('fr-FR');
    const u = ['k', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = -1, v = n;
    while (Math.abs(v) >= 1000 && i < u.length - 1) { v /= 1000; i++; }
    return v.toLocaleString('fr-FR', { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 }) + u[i];
  }
  function fmtTime(s) {
    if (!isFinite(s)) return '∞';
    if (s < 1) return 'maintenant';
    if (s < 90) return Math.round(s) + ' s';
    if (s < 5400) return Math.round(s / 60) + ' min';
    return (s / 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' h';
  }
  const pct = x => (x >= 0 ? '+' : '') + (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(x) < 0.1 ? 2 : 1 }) + ' %';

  function envLive() { return { factor: 1000, drones: st.drones, heat: st.heat, density: st.density }; }
  function onlineFraction() {
    if (cfg.onlineManual != null) return cfg.onlineManual;
    const spanMin = (Date.now() - hist.act.first) / 60000;
    if (spanMin < 720) return 0.5; // moins de 12 h de mesure : valeur neutre
    return Math.min(1, Math.max(0.05, hist.act.minutes / spanMin));
  }
  function spentOnLevels(S) {
    let total = 0;
    for (let w = 0; w < 3; w++) for (let t = 0; t < TRACK_COUNT[w]; t++)
      for (let L = 0; L < st.levels[w][t]; L++) total += cost(w, t, L, S);
    return total;
  }

  // ─── Réseau : écoute passive + achats ─────────────────────────────────────────
  const origFetch = window.fetch;
  function captureVersion(init) {
    const h = init && init.headers;
    if (!h) return;
    let v = null;
    if (typeof Headers !== 'undefined' && h instanceof Headers) v = h.get('X-ISB-Version');
    else if (Array.isArray(h)) { const p = h.find(x => String(x[0]).toLowerCase() === 'x-isb-version'); v = p && p[1]; }
    else for (const k in h) if (k.toLowerCase() === 'x-isb-version') v = h[k];
    if (v) st.version = String(v);
  }
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = url.indexOf('/api/') >= 0;
    if (isApi) captureVersion(init);
    const res = await origFetch.apply(this, arguments);
    if (isApi) {
      let path = '';
      try { path = new URL(url, location.href).pathname; } catch (e) { }
      if (path === '/api/snapshot' || path === '/api/sync')
        res.clone().json().then(j => {
          try { if (path === '/api/sync') onSync(j); else onSnapshot(j); } catch (e) { console.warn('[ISB auto]', e); }
        }).catch(() => { });
    }
    return res;
  };

  function onSnapshot(j) {
    if (!j || !j.World) return;
    const W = j.World;
    if (!st.version && j.ProtocolVersion) st.version = String(j.ProtocolVersion);
    st.me = j.PlayerId;
    const me = (W.Players || []).find(p => p.Id === j.PlayerId);
    if (!me) return;
    if (st.run !== -1 && W.Run !== st.run) newRun(W.Tick);
    st.levels = [[0, 0, 0], [0, 0, 0], [0, 0, 0, 0]];
    for (const w of me.Weapons || [])
      if (w.Kind >= 0 && w.Kind < 3) st.levels[w.Kind] = Array.from({ length: TRACK_COUNT[w.Kind] }, (_, k) => w.Levels[k] || 0);
    st.nodes = new Array(NODE_COUNT).fill(0);
    (me.Nodes || []).forEach((v, i) => { if (i < NODE_COUNT) st.nodes[i] = v ? 1 : 0; });
    st.credits = me.Credits; st.pp = me.PrestigePoints;
    st.run = W.Run; st.spawned = W.Spawned; st.droneHp = W.NextHpMicro / 1e6; st.tick = W.Tick;
    if (!st.runStartTick) st.runStartTick = W.Tick - W.Spawned * ticksPerDrone();
    const total = (W.Players || []).reduce((a, p) => a + (p.DamageThisRun || 0), 0);
    if (total > 0) st.share = Math.max(0.01, me.DamageThisRun / total);
    const heats = [];
    for (const p of W.Players || []) for (const w of p.Weapons || []) if (w.Kind === 1 && w.Unlocked) heats.push(w.HeatTicks || 0);
    if (heats.length) st.heat = Math.max(1, st.heat * 0.5 + 0.5 * heats.reduce((a, b) => a + b, 0) / heats.length);
    if (W.Drones && W.Drones.length) {
      st.drones = Math.max(3, Math.min(30, W.Drones.length));
      st.density = Math.max(5e-6, Math.min(1e-4, W.Drones.length / (540 * 600)));
    }
    st.ready = true;
    st.nodePlanKey = '';
    log('État chargé : ' + st.pp + '◇, ' + fmt(st.credits) + ' cr');
  }

  function onSync(j) {
    if (!j || !st.ready) return;
    // Au changement de run, les achats du lot peuvent dater d'avant la remise à zéro : on les ignore,
    // la réponse du prochain achat redonnera le niveau exact.
    const runChanged = j.Run !== st.run;
    if (runChanged) {
      newRun(j.ServerTick);
      st.run = j.Run;
    }
    let spent = 0;
    for (const ev of j.Events || []) {
      if (ev.PlayerId !== st.me || (runChanged && ev.Kind === 3)) continue;
      if (ev.Kind === 3 && ev.Weapon >= 0 && ev.Weapon < 3 && ev.Track >= 0 && ev.Track < TRACK_COUNT[ev.Weapon]) {
        st.levels[ev.Weapon][ev.Track] = Math.max(st.levels[ev.Weapon][ev.Track], ev.Level);
        spent += ev.Cost || 0;
      }
      if (ev.Kind === 6 && ev.Track > 0 && ev.Track < NODE_COUNT) { st.nodes[ev.Track] = 1; st.nodePlanKey = ''; }
    }
    // Revenu mesuré : variation des crédits + dépenses de la période
    if (st.lastSync && j.ServerTick > st.lastSync.tick) {
      const dt = (j.ServerTick - st.lastSync.tick) / TPS;
      const earned = j.Credits - st.lastSync.credits + spent;
      if (earned >= 0 && dt < 120) {
        const inc = earned / dt;
        const a = Math.min(1, dt / 60);
        st.income = st.income ? st.income * (1 - a) + inc * a : inc;
        st.runEarned += earned;
        const d = dps(stats(st.levels, sums(st.nodes)), unlockedOf(st.nodes), envLive()).total;
        if (d > 0) { const k = inc / d; st.kappa = st.kappa ? st.kappa * (1 - a) + k * a : k; }
      }
    }
    st.lastSync = { tick: j.ServerTick, credits: j.Credits };
    st.credits = j.Credits; st.spawned = j.Spawned; st.droneHp = j.NextDroneHp; st.tick = j.ServerTick;
    const top = j.Top || [];
    const mine = top.find(e => e.PlayerId === st.me);
    if (mine) st.pp = mine.PrestigePoints;
    const tot = top.reduce((a, e) => a + (e.Damage || 0), 0) + (mine ? 0 : (j.MyDamage || 0));
    if (tot > 0 && j.MyDamage >= 0) st.share = Math.max(0.01, j.MyDamage / tot);
  }

  function ticksPerDrone() {
    const r = hist.runs.filter(x => x.s > 0 && x.ticks > 0);
    if (!r.length) return 4;
    return r.reduce((a, x) => a + x.ticks / x.s, 0) / r.length;
  }
  function newRun(tick) {
    if (st.spawned > 1000) {
      hist.runs.push({ s: st.spawned, ticks: st.runStartTick ? tick - st.runStartTick : 0, earned: st.runEarned, at: Date.now() });
      hist.runs = hist.runs.slice(-8);
      persist();
      log('Nouveau run (le précédent a fini à ' + fmt(st.spawned) + ' drones)');
    }
    st.levels = [[0, 0, 0], [0, 0, 0], [0, 0, 0, 0]];
    st.runStartTick = tick; st.runEarned = 0; st.lastSync = null; st.nodePlanKey = '';
  }

  async function post(path, body) {
    // Identifie le script dans les journaux du serveur, pour distinguer un achat du helper d'un clic manuel.
    const headers = { 'Content-Type': 'application/json', 'X-Client': 'idle-ship-battle-helper' };
    if (st.version) headers['X-ISB-Version'] = st.version;
    st.busy = true; st.lastPost = performance.now();
    try {
      const r = await origFetch(path, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { st.failUntil = performance.now() + 15000; log('⚠ ' + path + ' → HTTP ' + r.status); return null; }
      if (typeof j.Credits === 'number') st.credits = j.Credits;
      if (typeof j.PrestigePoints === 'number') st.pp = j.PrestigePoints;
      if (!j.Ok) st.failUntil = performance.now() + 5000;
      return j;
    } catch (e) {
      st.failUntil = performance.now() + 15000;
      log('⚠ réseau : ' + e.message);
      return null;
    } finally { st.busy = false; }
  }

  // ─── Optimiseur des armes ─────────────────────────────────────────────────────
  // Critère : minimiser (temps pour réunir le prix) + (temps de retour sur investissement).
  function planWeapon(levels, credits) {
    const S = sums(st.nodes), unl = unlockedOf(st.nodes), env = envLive();
    const d0 = dps(stats(levels, S), unl, env).total;
    const kappa = st.kappa > 0 ? st.kappa : (1000 + S[E.Loot]) / 1000 * 0.6;
    const income = Math.max(st.income, d0 * kappa, 0.1);
    let best = null;
    for (let w = 0; w < 3; w++) {
      if (!unl[w]) continue;
      for (let t = 0; t < TRACK_COUNT[w]; t++) {
        const L = levels[w][t];
        if (L >= trackMax(w, t, S)) continue;
        const c = cost(w, t, L, S);
        levels[w][t]++;
        const d1 = dps(stats(levels, S), unl, env).total;
        levels[w][t]--;
        const gain = d1 - d0;
        if (gain <= 0) continue;
        const wait = Math.max(0, c - credits) / income;
        const score = wait + c / (gain * kappa);
        if (!best || score < best.score) best = { w, t, L, c, gain, rel: d0 > 0 ? gain / d0 : 1, wait, score };
      }
    }
    return best;
  }
  async function stepWeapons() {
    const plan = planWeapon(st.levels, st.credits);
    st.weaponPlan = plan;
    if (!plan || plan.c > st.credits) return false;
    // Regroupe les achats consécutifs identiques en une seule requête (Count)
    const lv = st.levels.map(a => a.slice());
    let credits = st.credits, count = 0;
    for (let k = 0; k < 50; k++) {
      const p = k === 0 ? plan : planWeapon(lv, credits);
      if (!p || p.w !== plan.w || p.t !== plan.t || p.c > credits) break;
      credits -= p.c; lv[p.w][p.t]++; count++;
    }
    const j = await post('/api/upgrade', { Weapon: plan.w, Track: plan.t, Count: count });
    if (j && j.Ok) {
      st.levels[plan.w][plan.t] = j.Level;
      log(WEAPON_NAMES[plan.w] + ' ' + TRACK_NAMES[plan.w][plan.t] + ' → niv ' + j.Level + (count > 1 ? ' (×' + count + ')' : ''));
      return true;
    }
    return false;
  }

  // ─── Optimiseur de l'arbre de prestige ───────────────────────────────────────
  const ADJ = (() => {
    const a = NODES.map(() => []);
    NODES.forEach((n, i) => n[4].forEach(p => { a[i].push(p); a[p].push(i); }));
    return a;
  })();

  function nodeContext() {
    const S = sums(st.nodes);
    const u = onlineFraction();
    const runs = hist.runs.filter(r => r.s > 1000);
    const sEnd = runs.length ? runs.reduce((a, r) => a + r.s, 0) / runs.length : Math.max(40000, st.spawned);
    // Crédits gagnés sur un run complet : historique, sinon extrapolation du run en cours
    let runCredits = runs.length ? runs.reduce((a, r) => a + (r.earned || 0), 0) / runs.length : 0;
    if (st.spawned > 2000) runCredits = Math.max(runCredits, st.runEarned * sEnd / st.spawned);
    runCredits = Math.max(runCredits, spentOnLevels(S) + st.credits, 1000);
    const bossHp = s => 150 * Math.max(10, st.droneHp) * (st.spawned > 5000 ? s / st.spawned : 1);
    let bossHpSum = 0;
    for (let n = 1; n <= Math.floor(sEnd / 5000); n++) bossHpSum += bossHp(5000 * n);
    const bounty = S2 => bossHpSum * S2[E.BossBounty] / 1000;
    const lootMul = S2 => (1000 + S2[E.Loot]) / 1000;
    const baseCredits = Math.max(1000, (runCredits - bounty(S) - S[E.HeadStart]) / lootMul(S));
    return { u, sEnd, tpd: ticksPerDrone(), env: { factor: 1000, drones: st.drones, heat: st.heat, density: st.density },
      budgetOf: S2 => baseCredits * lootMul(S2) + bounty(S2) + S2[E.HeadStart] };
  }
  function evaluate(nodes, ctx) {
    const S = sums(nodes), unl = unlockedOf(nodes);
    const on = Math.max(1e-9, greedySpend(ctx.budgetOf(S), S, unl, ctx.env).dps);
    const off = on * Math.min(1000, 250 + S[E.Reserve]) / 1000;
    return { S, on, eff: ctx.u * on + (1 - ctx.u) * off };
  }
  function gainOf(evNew, evCur, ctx) {
    const dLnD = Math.log(evNew.on / evCur.on);
    const dLnFleet = st.share * Math.log(evNew.eff / evCur.eff);
    const sNew = ctx.sEnd * Math.exp(cfg.eta * dLnFleet);
    const pCur = runPrestige(ctx.sEnd, evCur.S, ctx.u, ctx.tpd);
    const pNew = runPrestige(sNew, evNew.S, ctx.u, ctx.tpd);
    const dLnP = Math.log(pNew.rate / pCur.rate);
    return { dLnP, dLnD, score: cfg.wPrestige * dLnP + cfg.wDamage * dLnD };
  }
  function planNodes() {
    const ctx = nodeContext();
    const cur = evaluate(st.nodes, ctx);
    // Chemin le moins cher vers chaque nœud (Dijkstra pondéré par le coût des nœuds)
    const owned = i => i === 0 || !!st.nodes[i];
    const dist = new Array(NODE_COUNT).fill(Infinity), prev = new Array(NODE_COUNT).fill(-1), done = new Array(NODE_COUNT).fill(false);
    const open = [];
    for (let i = 0; i < NODE_COUNT; i++) if (owned(i)) { dist[i] = 0; open.push(i); }
    while (open.length) {
      open.sort((a, b) => dist[a] - dist[b]);
      const x = open.shift();
      if (done[x]) continue;
      done[x] = true;
      for (const y of ADJ[x]) {
        if (owned(y)) continue;
        const d = dist[x] + NODES[y][2];
        if (d < dist[y]) { dist[y] = d; prev[y] = x; open.push(y); }
      }
    }
    let best = null;
    for (let i = 1; i < NODE_COUNT; i++) {
      if (owned(i) || !isFinite(dist[i])) continue;
      const path = [];
      for (let x = i; x !== -1 && !owned(x); x = prev[x]) path.unshift(x);
      const nodes = st.nodes.slice();
      path.forEach(x => { nodes[x] = 1; });
      const g = gainOf(evaluate(nodes, ctx), cur, ctx);
      const perPoint = g.score / dist[i];
      if (g.score > 0 && (!best || perPoint > best.perPoint))
        best = Object.assign({ target: i, path, first: path[0], cost: dist[i], firstCost: NODES[path[0]][2], perPoint }, g);
    }
    return best;
  }
  async function stepNodes() {
    const key = st.nodes.join('') + '|' + st.run;
    if (key !== st.nodePlanKey || performance.now() - st.nodePlanAt > 60000) {
      st.nodePlan = planNodes();
      st.nodePlanKey = key; st.nodePlanAt = performance.now();
    }
    const p = st.nodePlan;
    if (!p || p.firstCost > st.pp) return false;
    const j = await post('/api/node', { Node: p.first });
    if (j && j.Ok) {
      st.nodes[p.first] = 1; st.nodePlanKey = '';
      log('Nœud #' + p.first + ' : ' + nodeLabel(p.first) + ' (' + p.firstCost + '◇)');
      return true;
    }
    return false;
  }

  // ─── Boucle principale ────────────────────────────────────────────────────────
  async function tick() {
    if (!st.ready || st.busy) return;
    const now = performance.now();
    if (now < st.failUntil || now - st.lastPost < 400) return;
    try {
      if (cfg.autoNodes) { if (await stepNodes()) return; }
      else if (!st.nodePlan || now - st.nodePlanAt > 60000) { st.nodePlan = planNodes(); st.nodePlanAt = now; }
      if (cfg.autoWeapons) await stepWeapons();
      else st.weaponPlan = planWeapon(st.levels, st.credits);
    } catch (e) { console.warn('[ISB auto]', e); }
  }
  setInterval(tick, 500);
  setInterval(() => { hist.act.minutes += 1; persist(); }, 60000);

  // ─── Panneau ──────────────────────────────────────────────────────────────────
  function buildPanel() {
    const box = document.createElement('div');
    box.id = 'isb-auto';
    box.style.cssText = 'position:fixed;top:56px;left:8px;z-index:900;width:330px;max-width:calc(100vw - 16px);' +
      'background:rgba(8,12,24,.88);border:1px solid #2c4a7a;color:#c9d6f0;font:12px/1.35 Arial,Helvetica,sans-serif;' +
      'padding:8px 10px;border-radius:4px;user-select:none;';
    for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend'])
      box.addEventListener(ev, e => e.stopPropagation());
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
      '<b style="color:#78dcff;letter-spacing:1px;flex:1">AUTO-ACHAT</b>' +
      '<button data-k="autoWeapons"></button><button data-k="autoNodes"></button><button data-k="collapse"></button></div>' +
      '<div id="isb-body"></div>';
    box.querySelectorAll('button').forEach(b => {
      b.style.cssText = 'background:#1a2a48;color:#c9d6f0;border:1px solid #2c4a7a;border-radius:3px;font:11px Arial;padding:2px 6px;cursor:pointer';
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        if (k === 'collapse') cfg.collapsed = !cfg.collapsed;
        else cfg[k] = !cfg[k];
        persist(); render();
      });
    });
    document.body.appendChild(box);
    render();
    setInterval(render, 1000);
  }
  function render() {
    const box = document.getElementById('isb-auto');
    if (!box) return;
    const btn = (k, label) => { const b = box.querySelector('[data-k="' + k + '"]'); b.textContent = label + (cfg[k] ? ' ON' : ' OFF'); b.style.color = cfg[k] ? '#8ef0a0' : '#f08e8e'; };
    btn('autoWeapons', 'Armes'); btn('autoNodes', 'Arbre');
    box.querySelector('[data-k="collapse"]').textContent = cfg.collapsed ? '+' : '–';
    const body = document.getElementById('isb-body');
    body.style.display = cfg.collapsed ? 'none' : '';
    if (cfg.collapsed) return;
    if (!st.ready) { body.innerHTML = '<i>En attente de l\'état du jeu…</i>'; return; }
    const S = sums(st.nodes);
    const w = st.weaponPlan, n = st.nodePlan;
    // Bandeau d'action : vert et « achète maintenant » si finançable, bleu et un délai sinon.
    function banner(ready, title, detail) {
      const c = ready ? '#8ef0a0' : '#78b4ff';
      return '<div style="margin:4px 0;padding:5px 7px;border-left:3px solid ' + c + ';background:rgba(255,255,255,.04)">' +
        '<div style="color:' + c + ';font-weight:bold">▶ ' + title + '</div>' +
        '<div style="color:#c9d6f0">' + detail + '</div></div>';
    }
    let h = '<div style="margin:3px 0"><span style="color:#8c9cc4">Crédits</span> <b style="color:#8ef0a0">' +
      fmt(st.credits) + '</b> · <span style="color:#8c9cc4">Prestige</span> <b style="color:#78b4ff">' + st.pp + '◇</b></div>';
    h += w ? banner(w.c <= st.credits, 'PROCHAIN ACHAT',
      WEAPON_NAMES[w.w] + ' → ' + TRACK_NAMES[w.w][w.t] + ' · ' + fmt(w.c) + ' cr · ' + pct(w.rel) + ' DPS · ' +
      (w.c <= st.credits ? 'maintenant' : 'dans ' + fmtTime(w.wait))) : '';
    h += n ? banner(n.firstCost <= st.pp, 'PROCHAIN NŒUD',
      nodeLabel(n.first) + ' · ' + n.firstCost + '◇' + (n.firstCost <= st.pp ? ' · maintenant' : ' · en attente de prestige') +
      (n.path.length > 1 ? '<br><span style="color:#8c9cc4">↳ vise</span> ' + nodeLabel(n.target) + ' (' + n.path.length + ' nœuds, ' + fmt(n.cost) + '◇)' : '')) : '';
    h += '<div style="margin-top:5px;border-top:1px solid #22385e;padding-top:4px;color:#8c9cc4;font-size:11px">' +
      st.log.map(x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>') + '</div>';
    body.innerHTML = h;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildPanel);
  else buildPanel();

  window.ISBAuto = { st, cfg, hist, planWeapon: () => planWeapon(st.levels, st.credits), planNodes, persist };
})();
