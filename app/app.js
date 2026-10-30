'use strict';
const STORE_KEY = 'mtg-life-tracker-prototype-v1';
const ACCENTS = {
  gold: '#d9bd79',
  white: '#e5e7eb',
  blue: '#73a8ed',
  black: '#aaa8c8',
  red: '#e47d7d',
  green: '#79c49a',
  violet: '#b99ae7'
};
const ACCENT_NAMES = {
  gold: 'Gold',
  white: 'White',
  blue: 'Blue',
  black: 'Black',
  red: 'Red',
  green: 'Green',
  violet: 'Violet'
};
const DUNGEONS = {
  lmop: {
    name: 'Lost Mine of Phandelver',
    start: 'cave',
    rooms: {
      cave: { n: 'Cave Entrance', t: 'Scry 1.', next: ['goblin', 'tunnels'] },
      goblin: { n: 'Goblin Lair', t: 'Create a 1/1 red Goblin creature token.', next: ['store', 'pool'] },
      tunnels: { n: 'Mine Tunnels', t: 'Create a Treasure token.', next: ['pool', 'fungi'] },
      store: { n: 'Storeroom', t: 'Put a +1/+1 counter on target creature.', next: ['temple'] },
      pool: {
        n: 'Dark Pool',
        t: 'Each opponent loses 1 life and you gain 1 life.',
        next: ['temple'],
        life: { you: 1, opp: -1 }
      },
      fungi: { n: 'Fungi Cavern', t: 'Target creature gets -4/-0 until your next turn.', next: ['temple'] },
      temple: { n: 'Temple of Dumathoin', t: 'Draw a card.', next: [] }
    }
  },
  mad: {
    name: 'Dungeon of the Mad Mage',
    start: 'portal',
    rooms: {
      portal: { n: 'Yawning Portal', t: 'You gain 1 life.', next: ['level'], life: { you: 1 } },
      level: { n: 'Dungeon Level', t: 'Scry 1.', next: ['bazaar', 'caverns'] },
      bazaar: { n: 'Goblin Bazaar', t: 'Create a Treasure token.', next: ['lost'] },
      caverns: {
        n: 'Twisted Caverns',
        t: "Target creature can't attack until your next turn.",
        next: ['lost']
      },
      lost: { n: 'Lost Level', t: 'Scry 2.', next: ['rune', 'grave'] },
      rune: {
        n: 'Runestone Caverns',
        t: 'Exile the top two cards of your library. You may play them.',
        next: ['mines']
      },
      grave: {
        n: "Muiral's Graveyard",
        t: 'Create two 1/1 black Skeleton creature tokens.',
        next: ['mines']
      },
      mines: { n: 'Deep Mines', t: 'Scry 3.', next: ['lair'] },
      lair: {
        n: "Mad Wizard's Lair",
        t: 'Draw three cards and reveal them. You may cast one of them without paying its mana cost.',
        next: []
      }
    }
  },
  tomb: {
    name: 'Tomb of Annihilation',
    start: 'entry',
    rooms: {
      entry: {
        n: 'Trapped Entry',
        t: 'Each player loses 1 life.',
        next: ['veils', 'oubliette'],
        life: { all: -1 }
      },
      veils: {
        n: 'Veils of Fear',
        t: 'Each player loses 2 life unless they discard a card.',
        next: ['sandfall'],
        choice: { kind: 'each', amount: 2, instead: 'Discarded a card' }
      },
      sandfall: {
        n: 'Sandfall Cell',
        t: 'Each player loses 2 life unless they sacrifice a creature, artifact, or land of their choice.',
        next: ['cradle'],
        choice: { kind: 'each', amount: 2, instead: 'Sacrificed a permanent' }
      },
      oubliette: {
        n: 'Oubliette',
        t: 'Discard a card and sacrifice a creature, an artifact, and a land.',
        next: ['cradle']
      },
      cradle: {
        n: 'Cradle of the Death God',
        t: 'Create The Atropal, a legendary 4/4 black God Horror creature token with deathtouch.',
        next: []
      }
    }
  },
  undercity: {
    name: 'Undercity',
    start: 'secret',
    rooms: {
      secret: {
        n: 'Secret Entrance',
        t: 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle.',
        next: ['forge', 'well']
      },
      forge: { n: 'Forge', t: 'Put two +1/+1 counters on target creature.', next: ['trap', 'arena'] },
      well: { n: 'Lost Well', t: 'Scry 2.', next: ['arena', 'stash'] },
      trap: {
        n: 'Trap!',
        t: 'Target player loses 5 life.',
        next: ['archives'],
        choice: { kind: 'target', amount: 5 }
      },
      arena: { n: 'Arena', t: 'Goad target creature.', next: ['archives', 'catacombs'] },
      stash: { n: 'Stash', t: 'Create a Treasure token.', next: ['catacombs'] },
      archives: { n: 'Archives', t: 'Draw a card.', next: ['throne'] },
      catacombs: {
        n: 'Catacombs',
        t: 'Create a 4/1 black Skeleton creature token with menace.',
        next: ['throne']
      },
      throne: {
        n: 'Throne of the Dead Three',
        t: 'Reveal the top ten cards of your library. Put a creature card from among them onto the battlefield with three +1/+1 counters on it. It gains hexproof until your next turn. Then shuffle.',
        next: []
      }
    }
  }
};
// Rooms grouped by depth, for drawing a dungeon as rows.
function dungeonLevels(d) {
  const lv = { [d.start]: 0 },
    order = [d.start];
  for (let i = 0; i < order.length; i++) {
    const r = order[i];
    d.rooms[r].next.forEach(n => {
      if (!(n in lv) || lv[n] < lv[r] + 1) {
        lv[n] = lv[r] + 1;
        if (!order.includes(n)) order.push(n);
      }
    });
  }
  const rows = [];
  Object.keys(d.rooms).forEach(r => {
    (rows[lv[r]] = rows[lv[r]] || []).push(r);
  });
  return rows;
}
const COUNTER_META = {
  poison: { label: 'Poison', symbol: '☠', color: '#e47d7d' },
  experience: { label: 'Experience', symbol: '✦', color: '#d9bd79' },
  energy: { label: 'Energy', symbol: '⚡', color: '#73a8ed' },
  rad: { label: 'Rad', symbol: '☢', color: '#79c49a' }
};
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const playerAccent = p =>
  /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : ACCENTS[p.theme] || ACCENTS.blue;
function defaultProfile(slot) {
  return {
    name: `Player ${slot}`,
    theme: ['blue', 'red', 'green', 'black', 'gold', 'violet'][(slot - 1) % 6],
    color: '',
    avatar: '',
    background: 'slate',
    rotation: null
  };
}
function validRotation(value) {
  return value !== null && value !== undefined && value !== '' && [0, 90, 180, 270].includes(Number(value));
}
function profileRotation(profile) {
  if (validRotation(profile.rotation) && profile.rotation !== null && profile.rotation !== '')
    return Number(profile.rotation);
  if (typeof profile.rotated === 'boolean') return profile.rotated ? 180 : 0;
  return null;
}
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...{
          prefs: { accent: 'gold' },
          lastSetup: { playerCount: 4, startingLife: 40 },
          profiles: {},
          savedProfiles: [],
          history: [],
          currentGame: null,
          lastResult: null
        },
        ...parsed,
        savedProfiles: Array.isArray(parsed.savedProfiles) ? parsed.savedProfiles : []
      };
    }
  } catch (e) {
    console.warn('Could not load saved app state', e);
  }
  return {
    prefs: { accent: 'gold' },
    lastSetup: { playerCount: 4, startingLife: 40 },
    profiles: {},
    savedProfiles: [],
    history: [],
    currentGame: null,
    lastResult: null
  };
}
let store = loadStore();
store.savedProfiles = Array.isArray(store.savedProfiles) ? store.savedProfiles : [];
let setupDraft = { ...store.lastSetup };
let wakeLock = null;
let currentScreen = 'menu';
const activePresses = new Map();
const pendingLife = Object.create(null);
let saveTimer = null;
let seatDragState = null;
let toastTimer = null;
let storageWarned = false;
let diceDrafts = Object.create(null);
let cardPanels = Object.create(null);
let cardToolScrollPositions = Object.create(null);
let customizeDrafts = Object.create(null);
let avatarDrafts = Object.create(null);
let pendingFirstPlayerSlot = Number(store.lastSetup?.firstPlayer) || 1;
// Saves are batched so rapid taps don't re-serialize the whole store (avatars included) every time.
function writeStore() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Could not save local state', e);
    if (!storageWarned) {
      storageWarned = true;
      notify(
        e?.name === 'QuotaExceededError'
          ? 'Local storage is full. Try using a smaller avatar image.'
          : 'Browser storage is unavailable; progress may not persist after closing.'
      );
    }
  }
}
function saveStore() {
  if (!saveTimer) saveTimer = setTimeout(writeStore, 250);
}
function currentTheme() {
  return store.prefs?.theme === 'light' ? 'light' : 'dark';
}
function applyTheme() {
  const t = currentTheme();
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', t === 'light' ? '#f3f4f7' : '#101114');
  const btn = $('#theme-toggle');
  if (btn) {
    const next = t === 'light' ? 'dark' : 'light';
    btn.setAttribute('aria-label', `Switch to ${next} mode`);
    btn.innerHTML = `${icon(next === 'light' ? 'sun' : 'moon')}<span>${next === 'light' ? 'Light' : 'Dark'} mode</span>`;
  }
  const opts = $('#theme-options');
  if (opts)
    opts.innerHTML = [
      ['dark', 'moon', 'Dark'],
      ['light', 'sun', 'Light']
    ]
      .map(
        ([k, ic, l]) =>
          `<button type="button" class="segment ${t === k ? 'selected' : ''}" data-action="set-theme" data-mode="${k}" aria-pressed="${t === k}" style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;font-size:13px">${icon(ic)} ${l}</button>`
      )
      .join('');
}
function setTheme(mode) {
  store.prefs = { ...(store.prefs || {}), theme: mode === 'light' ? 'light' : 'dark' };
  saveStore();
  applyTheme();
}
function applyAccent() {
  document.documentElement.style.setProperty('--accent', ACCENTS[store.prefs?.accent] || ACCENTS.gold);
}
function showToast(message) {
  /* Success popups stay off; state changes remain visible in the relevant card or panel. */
}
function notify(message, kind = 'error') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message;
  t.classList.toggle('error', kind === 'error');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), kind === 'error' ? 3200 : 2400);
}
function showScreen(name) {
  currentScreen = name;
  updateWakeLock();
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  window.scrollTo?.(0, 0);
  if (name === 'menu') renderMenuMeta();
  if (name === 'setup') renderSetup();
  if (name === 'settings') renderSettings();
  if (name === 'history') renderHistory();
  if (name === 'game' && store.currentGame) renderGame();
  if (name === 'gameover') renderGameover();
}
function renderMenuMeta() {
  const quick = $('[data-action="quick-start"] .menu-subtitle');
  if (quick)
    quick.textContent = `Load last setup · ${store.lastSetup?.playerCount || 4} players · ${store.lastSetup?.startingLife ?? 40} life`;
  const hist = $('#menu-history-subtitle');
  if (hist) {
    const n = (store.history || []).length;
    hist.textContent = n ? `${n} of 15 completed games saved` : 'No completed games yet';
  }
  const nav = $('.menu');
  let resume = $('#resume-current-game-btn');
  $('.menu-btn[data-action="go-setup"]')?.classList.toggle('primary', !store.currentGame);
  if (store.currentGame) {
    if (!resume) {
      resume = document.createElement('button');
      resume.id = 'resume-current-game-btn';
      resume.className = 'menu-btn primary';
      resume.dataset.action = 'resume-current-game';
      resume.innerHTML = `<span class="icon-box" style="color:var(--green)">${icon('play')}</span><span class="menu-copy"><span class="menu-title">Resume Game</span><span class="menu-subtitle">${store.currentGame.players.length} players · pick up where you left off</span></span>${icon('chevron', 'chevron')}`;
      nav.insertBefore(resume, nav.firstChild);
    } else
      resume.querySelector('.menu-subtitle').textContent =
        `${store.currentGame.players.length} players · pick up where you left off`;
  } else if (resume) resume.remove();
}
const LIFE_PRESETS = [
  [20, 'Standard'],
  [30, 'Brawl'],
  [40, 'Commander']
];
function setupSeatName(slot) {
  const d = setupDraft.names?.[slot];
  if (typeof d === 'string') return d;
  return store.profiles?.[String(slot)]?.name || `Player ${slot}`;
}
function renderSetupPlayers(count) {
  const holder = $('#setup-players');
  if (!holder) return;
  const saved = store.savedProfiles || [];
  holder.innerHTML = Array.from({ length: count }, (_, i) => {
    const slot = i + 1,
      prof = { ...defaultProfile(slot), ...(store.profiles?.[String(slot)] || {}) },
      chosen = setupDraft.profiles?.[slot] || '';
    const sp = saved.find(x => x.id === chosen);
    const accent =
      sp?.profile?.color || prof.color || ACCENTS[sp?.profile?.theme || prof.theme] || ACCENTS.blue;
    return `<div class="setup-player"><span class="seat-dot" style="background:${accent}" aria-hidden="true">${slot}</span><input class="text-field" id="setup-name-${slot}" data-setup-name="${slot}" maxlength="32" value="${esc(setupSeatName(slot))}" aria-label="Seat ${slot} player name" autocomplete="off">${saved.length ? `<select class="select-field" id="setup-profile-${slot}" data-setup-profile="${slot}" aria-label="Saved profile for seat ${slot}"><option value="">Saved profile…</option>${saved.map(x => `<option value="${esc(x.id)}"${x.id === chosen ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div>`;
  }).join('');
}
// Before a game starts: the names and chosen profiles on the setup screen become each seat's profile.
function applySetupPlayers(count) {
  store.profiles = store.profiles || {};
  for (let slot = 1; slot <= count; slot++) {
    const key = String(slot),
      cur = { ...defaultProfile(slot), ...(store.profiles[key] || {}) };
    const sp = (store.savedProfiles || []).find(x => x.id === setupDraft.profiles?.[slot]);
    const next = sp
      ? {
          ...cur,
          theme: sp.profile?.theme || cur.theme,
          color: sp.profile?.color || '',
          avatar: sp.profile?.avatar || '',
          background: sp.profile?.background || 'slate',
          partner: !!sp.profile?.partner
        }
      : cur;
    const typed = String($(`#setup-name-${slot}`)?.value ?? setupSeatName(slot))
      .trim()
      .slice(0, 32);
    next.name = typed || sp?.name || `Player ${slot}`;
    delete next.rotation;
    store.profiles[key] = next;
  }
}
function renderSetup() {
  const count = Number(setupDraft.playerCount) || 4;
  renderSetupPlayers(count);
  $('#player-count-options').innerHTML = [2, 3, 4, 5, 6]
    .map(
      n =>
        `<button class="count-option ${count === n ? 'selected' : ''}" data-action="choose-count" data-count="${n}" aria-pressed="${count === n}">${n}</button>`
    )
    .join('');
  const input = $('#starting-life-input');
  if (input && document.activeElement !== input)
    input.value = Number.isFinite(Number(setupDraft.startingLife)) ? setupDraft.startingLife : 40;
  const life = Number(input?.value);
  const presets = $('#life-presets');
  if (presets)
    presets.innerHTML = LIFE_PRESETS.map(
      ([n, label]) =>
        `<button type="button" class="segment life-preset ${life === n ? 'selected' : ''}" data-action="setup-life-preset" data-life="${n}" aria-pressed="${life === n}"><b>${n}</b> ${label}</button>`
    ).join('');
  const layoutHolder = $('#layout-options');
  if (layoutHolder)
    layoutHolder.innerHTML = layoutOptionsMarkup(
      count,
      layoutFor(count, setupDraft.layouts?.[count]).id,
      'choose-layout'
    );
}
function makePlayer(slot, life) {
  const profile = { ...defaultProfile(slot), ...(store.profiles?.[String(slot)] || {}) };
  return {
    id: `p${slot}`,
    slot,
    name: profile.name || `Player ${slot}`,
    theme: profile.theme || defaultProfile(slot).theme,
    color: profile.color || '',
    avatar: profile.avatar || '',
    background: profile.background || 'slate',
    rotation: profileRotation(profile),
    life: Number(life),
    eliminated: false,
    eliminationReason: null,
    partner: !!profile.partner,
    counters: { poison: 0, experience: 0, energy: 0, rad: 0, custom: [] },
    commanderDamage: {},
    commanderTax: 0,
    commanderTax2: 0
  };
}
function syncProfiles(players) {
  store.profiles = store.profiles || {};
  players.forEach(p => {
    store.profiles[String(p.slot)] = {
      name: p.name,
      theme: p.theme,
      color: p.color || '',
      avatar: p.avatar,
      background: p.background,
      partner: !!p.partner
    };
  });
}
// Table layouts for a tablet lying flat in the middle of the table. Each seat names its grid area and which edge the
// player sits at (rotation: 0 = near/bottom edge, 180 = far/top edge, 90 = left end, 270 = right end), so every card
// faces its player. Seats are listed clockwise around the table, which is also the turn order.
const LAYOUTS = {
  2: [
    {
      id: 'across',
      label: 'Across from each other',
      areas: ['t', 'b'],
      seats: [
        ['t', 180],
        ['b', 0]
      ]
    },
    {
      id: 'ends',
      label: 'At opposite ends',
      areas: ['l r'],
      seats: [
        ['l', 90],
        ['r', 270]
      ]
    },
    {
      id: 'same',
      label: 'Same side',
      areas: ['l r'],
      seats: [
        ['l', 0],
        ['r', 0]
      ]
    }
  ],
  3: [
    {
      id: '1-2',
      label: 'One across, two on this side',
      areas: ['t t', 'bl br'],
      seats: [
        ['t', 180],
        ['br', 0],
        ['bl', 0]
      ]
    },
    {
      id: 'end-sides',
      label: 'One at the end, one on each side',
      areas: ['e t', 'e b'],
      cols: 'minmax(0,1fr) minmax(0,1.7fr)',
      seats: [
        ['e', 90],
        ['t', 180],
        ['b', 0]
      ]
    },
    {
      id: '2-1',
      label: 'Two across, one on this side',
      areas: ['tl tr', 'b b'],
      seats: [
        ['tl', 180],
        ['tr', 180],
        ['b', 0]
      ]
    }
  ],
  4: [
    {
      id: '2-2',
      label: 'Two on each side',
      areas: ['tl tr', 'bl br'],
      seats: [
        ['tl', 180],
        ['tr', 180],
        ['br', 0],
        ['bl', 0]
      ]
    },
    {
      id: '1-each',
      label: 'One on every side',
      areas: ['l t r', 'l b r'],
      cols: 'minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr)',
      seats: [
        ['l', 90],
        ['t', 180],
        ['r', 270],
        ['b', 0]
      ]
    }
  ],
  5: [
    {
      id: '2-2-1',
      label: 'Two on each side, one at the end',
      areas: ['e tl tr', 'e bl br'],
      cols: 'minmax(0,.9fr) minmax(0,1.3fr) minmax(0,1.3fr)',
      seats: [
        ['e', 90],
        ['tl', 180],
        ['tr', 180],
        ['br', 0],
        ['bl', 0]
      ]
    },
    {
      id: '2-3',
      label: 'Two across, three on this side',
      areas: ['t1 t1 t1 t2 t2 t2', 'b1 b1 b2 b2 b3 b3'],
      seats: [
        ['t1', 180],
        ['t2', 180],
        ['b3', 0],
        ['b2', 0],
        ['b1', 0]
      ]
    }
  ],
  6: [
    {
      id: '3-3',
      label: 'Three on each side',
      areas: ['t1 t2 t3', 'b1 b2 b3'],
      seats: [
        ['t1', 180],
        ['t2', 180],
        ['t3', 180],
        ['b3', 0],
        ['b2', 0],
        ['b1', 0]
      ]
    },
    {
      id: '2-2-ends',
      label: 'Two on each side, one at each end',
      areas: ['l t1 t2 r', 'l b1 b2 r'],
      cols: 'minmax(0,.85fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,.85fr)',
      seats: [
        ['l', 90],
        ['t1', 180],
        ['t2', 180],
        ['r', 270],
        ['b2', 0],
        ['b1', 0]
      ]
    }
  ]
};
function layoutsFor(count) {
  const list = LAYOUTS[count] || LAYOUTS[4];
  return [
    ...list,
    { ...list[0], id: 'flat', label: 'All facing this side', seats: list[0].seats.map(([a]) => [a, 0]) }
  ];
}
function layoutFor(count, id) {
  const list = layoutsFor(count);
  return list.find(l => l.id === id) || list[0];
}
// Layouts are drawn for a device lying sideways, players along its long top and bottom edges.
// When the screen is upright, turn the whole plan a quarter turn so those players sit along the long
// left and right edges, each card still facing its player. Layouts where everyone faces this side
// only change shape. Seat numbers (and so turn order) stay the same.
function isUpright() {
  return window.innerHeight > window.innerWidth;
}
function orientLayout(layout, upright = isUpright()) {
  if (!upright) return layout;
  const grid = layout.areas.map(r => r.trim().split(/\s+/)),
    R = grid.length,
    C = grid[0].length;
  const areas = Array.from({ length: C }, (_, r) =>
    Array.from({ length: R }, (_, c) => grid[R - 1 - c][r]).join(' ')
  );
  const flat = layout.seats.every(([, rot]) => !rot);
  const seats = layout.seats.map(([a, rot]) => [a, flat ? 0 : ((rot || 0) + 90) % 360]);
  return { ...layout, areas, cols: undefined, rows: layout.cols || undefined, seats };
}
function gameLayout(g) {
  return orientLayout(layoutFor(g.players.length, g.layout));
}
function seatRotation(g, index) {
  return gameLayout(g).seats[index]?.[1] || 0;
}
function layoutMiniMarkup(layout) {
  layout = orientLayout(layout);
  const cols = layout.cols || `repeat(${layout.areas[0].split(' ').length},minmax(0,1fr))`;
  const rows = layout.rows || `repeat(${layout.areas.length},minmax(0,1fr))`;
  return `<div class="layout-mini${isUpright() ? ' upright' : ''}" style="grid-template-areas:${layout.areas.map(r => `'${r}'`).join(' ')};grid-template-columns:${cols};grid-template-rows:${rows}">${layout.seats.map(([area, rot], i) => `<span class="r${rot}" style="grid-area:${area}">${i + 1}</span>`).join('')}</div>`;
}
function layoutOptionsMarkup(count, selected, action) {
  return layoutsFor(count)
    .map(
      l =>
        `<button type="button" class="layout-option ${l.id === selected ? 'selected' : ''}" data-action="${action}" data-layout="${l.id}" aria-pressed="${l.id === selected}">${layoutMiniMarkup(l)}<span class="layout-label">${esc(l.label)}</span></button>`
    )
    .join('');
}
function validPermutation(order, ids) {
  return (
    Array.isArray(order) &&
    order.length === ids.length &&
    new Set(order).size === ids.length &&
    ids.every(id => order.includes(id))
  );
}
function normalizedSeatOrder(g) {
  const ids = g.players.map(p => p.id);
  if (!validPermutation(g.seatOrder, ids)) g.seatOrder = ids.slice();
  return g.seatOrder;
}
// Layout seats are listed clockwise, so turn order is seat order (clockwise) or seat order reversed (counterclockwise).
function turnOrderForSeats(seatOrder, direction = 'cw') {
  const order = seatOrder.slice();
  return direction === 'ccw' ? order.reverse() : order;
}
function directionLabel(direction) {
  return direction === 'ccw' ? 'Counterclockwise' : 'Clockwise';
}
function directionOptionsMarkup(current, action) {
  return [
    ['cw', '↻'],
    ['ccw', '↺']
  ]
    .map(
      ([k, arrow]) =>
        `<button type="button" class="segment ${current === k ? 'selected' : ''}" data-action="${action}" data-dir="${k}" aria-pressed="${current === k}" style="padding:9px 14px;font-size:13px"><span aria-hidden="true" style="font-size:15px">${arrow}</span> ${directionLabel(k)}</button>`
    )
    .join('');
}
function setTurnDirection(direction) {
  const g = currentGame();
  if (!g) return;
  direction = direction === 'ccw' ? 'ccw' : 'cw';
  store.lastSetup = { ...(store.lastSetup || {}), turnDirection: direction };
  if (g.turnDirection !== direction) {
    g.turnDirection = direction;
    g.turnOrder = turnOrderForSeats(normalizedSeatOrder(g), direction);
    appendEvent(`Turn direction set to ${directionLabel(direction).toLowerCase()}`, 'turn');
  }
  saveStore();
  renderGame();
}
function ensureTurnState(g) {
  if (!g) return;
  let changed = false;
  const ids = g.players.map(p => p.id);
  if (!validPermutation(g.seatOrder, ids)) {
    g.seatOrder = ids.slice();
    changed = true;
  }
  if (g.turnDirection !== 'cw' && g.turnDirection !== 'ccw') {
    g.turnDirection = 'cw';
    changed = true;
  }
  if (!g.layout || !layoutsFor(g.players.length).some(l => l.id === g.layout)) {
    g.layout = layoutFor(g.players.length).id;
    g.turnOrder = turnOrderForSeats(g.seatOrder, g.turnDirection);
    changed = true;
  }
  if (!Object.prototype.hasOwnProperty.call(g, 'monarchPlayerId')) {
    g.monarchPlayerId = null;
    changed = true;
  }
  g.players.forEach(p => {
    if (!Number.isFinite(Number(p.commanderTax)) || Number(p.commanderTax) < 0) {
      p.commanderTax = 0;
      changed = true;
    }
    if (!p.commanderDamage || typeof p.commanderDamage !== 'object') {
      p.commanderDamage = {};
      changed = true;
    }
  });
  if (!validPermutation(g.turnOrder, ids)) {
    g.turnOrder = turnOrderForSeats(g.seatOrder, g.turnDirection);
    changed = true;
  }
  if (!Number.isFinite(Number(g.turnNumber)) || g.turnNumber < 1) {
    g.turnNumber = 1;
    changed = true;
  }
  if (typeof g.timerStarted !== 'boolean') {
    g.timerStarted = !!(g.startedAt && g.activePlayerId && g.turnStartedAt);
    changed = true;
  }
  if (g.timerStarted) {
    if (g.activePlayerId && !Number.isFinite(Number(g.turnStartedAt))) {
      g.turnStartedAt = Date.now();
      changed = true;
    }
  } else {
    if (g.activePlayerId !== null && g.activePlayerId !== undefined) {
      g.activePlayerId = null;
      changed = true;
    }
    if (g.turnStartedAt !== null && g.turnStartedAt !== undefined) {
      g.turnStartedAt = null;
      changed = true;
    }
    if (g.startedAt !== null && g.startedAt !== undefined) {
      g.startedAt = null;
      changed = true;
    }
  }
  if (changed) saveStore();
}
function startGame(quick = false, confirmed = false) {
  if (store.currentGame && !confirmed) {
    openModal(
      'Start a New Game?',
      `<p class="modal-note">A game is still in progress. Starting a new one will discard that active game, but your completed-game history will stay saved.</p><div class="dialog-footer"><button class="btn-secondary" data-action="resume-current-game">Return to Current Game</button><button class="btn-primary" data-action="confirm-new-game" data-quick="${quick ? 'true' : 'false'}">Start New Game</button></div>`
    );
    return;
  }
  let count = Number(setupDraft.playerCount) || Number(store.lastSetup?.playerCount) || 4;
  let life = Number(setupDraft.startingLife);
  if (!Number.isFinite(life) || !Number.isInteger(life)) life = Number(store.lastSetup?.startingLife ?? 40);
  if (quick) {
    count = Number(store.lastSetup?.playerCount) || 4;
    life = Number(store.lastSetup?.startingLife ?? 40);
  }
  count = Math.min(6, Math.max(2, Math.floor(count)));
  const lastStarter = Math.min(count, Math.max(1, Math.floor(Number(store.lastSetup?.firstPlayer) || 1)));
  const layouts = { ...(store.lastSetup?.layouts || {}), ...(quick ? {} : setupDraft.layouts || {}) },
    layout = layoutFor(count, layouts[count]);
  layouts[count] = layout.id;
  store.lastSetup = {
    ...(store.lastSetup || {}),
    playerCount: count,
    startingLife: life,
    firstPlayer: lastStarter,
    layouts
  };
  setupDraft = { playerCount: count, startingLife: life, layouts: { ...layouts } };
  const players = Array.from({ length: count }, (_, i) => makePlayer(i + 1, life));
  // Each card faces the edge its seat is on; turns go clockwise in seat order.
  players.forEach((p, i) => {
    p.rotation = layout.seats[i]?.[1] || 0;
  });
  const createdAt = Date.now();
  cardToolScrollPositions = Object.create(null);
  cardPanels = Object.create(null);
  customizeDrafts = Object.create(null);
  avatarDrafts = Object.create(null);
  diceDrafts = Object.create(null);
  Object.keys(pendingLife).forEach(id => {
    clearTimeout(pendingLife[id].timer);
    delete pendingLife[id];
  });
  clearAllPresses();
  store.currentGame = {
    id: uid(),
    createdAt,
    startedAt: null,
    timerStarted: false,
    playerCount: count,
    startingLife: life,
    layout: layout.id,
    turnDirection: store.lastSetup?.turnDirection === 'ccw' ? 'ccw' : 'cw',
    players,
    seatOrder: players.map(p => p.id),
    monarchPlayerId: null,
    events: [],
    undoStack: [],
    rollSerial: 0,
    turnOrder: turnOrderForSeats(
      players.map(p => p.id),
      store.lastSetup?.turnDirection
    ),
    activePlayerId: null,
    turnStartedAt: null,
    turnNumber: 1
  };
  store.lastResult = null;
  appendEvent(`Game table ready · ${count} players · ${life} starting life · timers not started`, 'system');
  saveStore();
  showScreen('game');
  if (quick) openStartTimerModal();
}
function openStartTimerModal(preserveSelection = false) {
  const g = currentGame();
  if (!g || g.timerStarted) {
    return;
  }
  const fallback = Number(store.lastSetup?.firstPlayer) || 1;
  if (!preserveSelection || !g.players.some(p => p.slot === pendingFirstPlayerSlot && !p.eliminated))
    pendingFirstPlayerSlot = fallback;
  pendingFirstPlayerSlot = Number(pendingFirstPlayerSlot) || fallback;
  const options = g.players
    .map(
      p =>
        `<button type="button" class="count-option first-player-option ${pendingFirstPlayerSlot === p.slot ? 'selected' : ''}" data-action="choose-game-starter" data-slot="${p.slot}" style="display:flex;align-items:center;justify-content:center;gap:8px;border-color:${pendingFirstPlayerSlot === p.slot ? playerAccent(p) : 'var(--line)'}" ${p.eliminated ? 'disabled' : ''}><span style="width:9px;height:9px;border-radius:50%;background:${playerAccent(p)};display:inline-block"></span>${esc(p.name)}${pendingFirstPlayerSlot === p.slot ? ' ✓' : ''}</button>`
    )
    .join('');
  openModal(
    'Start Timer',
    `<p class="modal-note">The game table is ready, but the clocks are still stopped. Choose who takes the first turn, then start both timers together.</p><div class="first-player-grid">${options}</div><div class="field-label" style="margin:18px 0 8px">Turn direction</div><div class="segmented">${directionOptionsMarkup(g.turnDirection, 'choose-start-direction')}</div><div class="dialog-footer"><button type="button" class="btn-secondary" data-action="close-modal">Not Yet</button><button type="button" class="btn-primary" data-action="start-timers"><svg><use href="#i-play"/></svg> Start Timer</button></div>`,
    true
  );
}
function startGameTimers() {
  const g = currentGame();
  if (!g || g.timerStarted) return;
  const starter =
    g.players.find(p => p.slot === Number(pendingFirstPlayerSlot) && !p.eliminated) ||
    g.players.find(p => !p.eliminated);
  if (!starter) {
    notify('No eligible starting player is available');
    return;
  }
  const now = Date.now();
  g.timerStarted = true;
  g.paused = false;
  g.pausedAt = null;
  g.startedAt = now;
  g.activePlayerId = starter.id;
  g.turnStartedAt = now;
  g.turnNumber = 1;
  store.lastSetup = {
    ...(store.lastSetup || {}),
    playerCount: g.playerCount,
    startingLife: g.startingLife,
    firstPlayer: starter.slot
  };
  appendEvent(`Timers started · ${starter.name} takes the first turn`, 'turn', {
    playerId: starter.id,
    turnNumber: 1
  });
  saveStore();
  closeModal();
  renderGame();
  showToast(`${starter.name} starts · timers running`);
}
function currentGame() {
  return store.currentGame;
}
function formatDuration(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60),
    seconds = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
// While paused, the clocks read as if time stopped at pausedAt; resuming shifts the start times forward by the paused span.
function clockNow(g) {
  return g?.paused && g.pausedAt ? g.pausedAt : Date.now();
}
function togglePause() {
  const g = currentGame();
  if (!g || !g.timerStarted) return;
  const now = Date.now();
  if (g.paused) {
    const shift = Math.max(0, now - (g.pausedAt || now));
    g.startedAt += shift;
    if (g.turnStartedAt) g.turnStartedAt += shift;
    g.paused = false;
    g.pausedAt = null;
    appendEvent(`Timers resumed after ${formatDuration(shift)}`, 'system');
  } else {
    g.paused = true;
    g.pausedAt = now;
    appendEvent('Timers paused', 'system');
  }
  saveStore();
  renderGame();
}
function updateGameClocks() {
  const g = currentGame();
  if (!g) return;
  const running = !!(g.timerStarted && g.startedAt),
    now = clockNow(g);
  const gameClock = $('#game-elapsed');
  if (gameClock) gameClock.textContent = formatDuration(running ? now - g.startedAt : 0);
  const elapsed = running && g.activePlayerId && g.turnStartedAt ? now - g.turnStartedAt : 0;
  $$('[data-turn-elapsed]').forEach(el => {
    el.textContent = formatDuration(elapsed);
  });
  $('#start-timer-btn')?.classList.toggle('hidden', running);
  const pause = $('#pause-timer-btn');
  if (pause) {
    pause.classList.toggle('hidden', !running);
    const label = g.paused ? 'Resume' : 'Pause';
    if (pause.dataset.state !== label) {
      pause.dataset.state = label;
      pause.setAttribute('aria-label', `${label} timers`);
      pause.innerHTML = `${icon(g.paused ? 'play' : 'pause')} <span>${label}</span>`;
    }
  }
  $('#game-status')?.classList.toggle('paused', !!g.paused);
  $('#paused-label')?.classList.toggle('hidden', !g.paused);
  const hubClock = $('#hub-clock');
  if (hubClock) hubClock.textContent = formatDuration(running ? now - g.startedAt : 0);
  const hubBtn = $('#hub-timer-btn');
  if (hubBtn && g.timerStarted && hubBtn.dataset.state !== (g.paused ? 'Resume' : 'Pause'))
    hubBtn.outerHTML = hubTimerButton(g);
  const hs = $('#hub-state');
  if (hs) {
    const st = !g.timerStarted ? '' : g.paused ? 'paused' : 'running';
    if (hs.dataset.state !== st) {
      hs.dataset.state = st;
      $('#hub-btn')?.setAttribute(
        'aria-label',
        `Table menu: game time${st === 'paused' ? ' (timers paused)' : st === 'running' ? ' (timers running)' : ''}, timers, game log, end game`
      );
    }
  }
}
function nextLivingPlayer(g, fromId) {
  ensureTurnState(g);
  const order = g.turnOrder || [];
  const start = order.indexOf(fromId);
  if (start < 0) return null;
  for (let step = 1; step < order.length; step++) {
    const p = g.players.find(p => p.id === order[(start + step) % order.length]);
    if (p && !p.eliminated) return p;
  }
  return null;
}
function advanceIfCurrentEliminated(frame) {
  const g = currentGame();
  if (!g || !g.activePlayerId) return;
  const active = getPlayer(g.activePlayerId);
  if (!active?.eliminated) return;
  const now = clockNow(g),
    elapsed = g.turnStartedAt ? Math.max(0, now - g.turnStartedAt) : 0,
    next = nextLivingPlayer(g, active.id);
  frame.changes.push({
    kind: 'turn',
    beforeActivePlayerId: g.activePlayerId,
    beforeTurnElapsedMs: elapsed,
    beforeTurnNumber: g.turnNumber
  });
  g.activePlayerId = next?.id || null;
  g.turnStartedAt = next ? now : null;
  if (next) g.turnNumber = (g.turnNumber || 1) + 1;
  frame.eventIds.push(
    appendEvent(
      next
        ? `Turn moved automatically · ${active.name} eliminated → ${next.name}`
        : `Active turn ended · ${active.name} eliminated; no active players remain`,
      'turn',
      { fromPlayerId: active.id, toPlayerId: next?.id || null, turnNumber: g.turnNumber }
    )
  );
}
function passTurn(playerId) {
  const g = currentGame();
  if (!g) return;
  ensureTurnState(g);
  if (!g.timerStarted) {
    notify('Start the timer and choose the first player first');
    return;
  }
  const active = getPlayer(g.activePlayerId);
  if (!active || active.id !== playerId) {
    notify(active ? `It's ${active.name}'s turn to pass` : 'No active turn is selected');
    return;
  }
  const next = nextLivingPlayer(g, active.id);
  if (!next) {
    notify('No other active players. Use End Game when ready.');
    return;
  }
  const now = clockNow(g),
    elapsed = g.turnStartedAt ? Math.max(0, now - g.turnStartedAt) : 0,
    oldTurnNumber = g.turnNumber || 1;
  const message = `${active.name} passed the turn to ${next.name} · Turn lasted ${formatDuration(elapsed)}`;
  const eventId = appendEvent(message, 'turn', {
    fromPlayerId: active.id,
    toPlayerId: next.id,
    turnNumber: oldTurnNumber,
    turnElapsedMs: elapsed
  });
  const frame = {
    description: `${active.name} passed the turn to ${next.name}`,
    changes: [
      {
        kind: 'turn',
        beforeActivePlayerId: active.id,
        beforeTurnElapsedMs: elapsed,
        beforeTurnNumber: oldTurnNumber
      }
    ],
    eventIds: [eventId]
  };
  g.activePlayerId = next.id;
  g.turnStartedAt = now;
  g.turnNumber = oldTurnNumber + 1;
  pushFrame(frame);
  renderGame();
  showToast(`Turn passed to ${next.name}`);
}

function getPlayer(id) {
  return currentGame()?.players.find(p => p.id === id);
}
function appendEvent(message, type = 'action', extra = {}) {
  const g = currentGame();
  if (!g) return null;
  const event = { id: uid(), at: Date.now(), message, type, undone: false, ...extra };
  g.events.push(event);
  return event.id;
}
function pushFrame(frame) {
  const g = currentGame();
  if (!g) return;
  g.undoStack.push(frame);
  saveStore();
}
// Life at or below 0 never eliminates automatically (some cards keep players alive). Only the counter that just changed is checked,
// so a player who was revived isn't knocked out again by an unrelated change.
function autoEliminationReason(p, kinds) {
  if (kinds.includes('poison') && (p.counters?.poison || 0) >= 10) return 'poison';
  if (kinds.includes('commander')) {
    for (const damage of Object.values(p.commanderDamage || {})) {
      if (damage >= 21) return 'commander damage';
    }
  }
  return null;
}
function checkEliminations(frame, playerId, kinds) {
  const g = currentGame(),
    p = getPlayer(playerId);
  if (!g || !p || p.eliminated) return;
  const reason = autoEliminationReason(p, kinds);
  if (!reason) return;
  frame.changes.push({ playerId: p.id, kind: 'elimination', before: false, beforeReason: null });
  p.eliminated = true;
  p.eliminationReason = reason;
  frame.eventIds.push(
    appendEvent(
      `${p.name} eliminated · ${reason === 'poison' ? 'reached 10 poison counters' : 'received 21 damage from one commander'}`,
      'elimination',
      { playerId: p.id }
    )
  );
  handleMonarchLeaving(frame, [p.id]);
  handleInitiativeLeaving(frame, [p.id]);
  advanceIfCurrentEliminated(frame);
}
function doChange(change, message, type = 'action', check = true) {
  const g = currentGame();
  if (!g) return;
  const p = getPlayer(change.playerId);
  if (!p) return;
  let before;
  if (change.kind === 'life') before = p.life;
  else if (change.kind === 'counter') before = p.counters[change.counterKey] || 0;
  else if (change.kind === 'customCounter') {
    const c = p.counters.custom.find(c => c.id === change.counterId);
    if (!c) return;
    before = c.value || 0;
  } else if (change.kind === 'commander') {
    before = p.commanderDamage[change.sourceId] || 0;
  } else return;
  if (before === change.value) return;
  const frame = { description: message, changes: [{ ...change, before, value: undefined }], eventIds: [] };
  if (change.kind === 'life') p.life = change.value;
  else if (change.kind === 'counter') p.counters[change.counterKey] = change.value;
  else if (change.kind === 'customCounter') {
    const c = p.counters.custom.find(c => c.id === change.counterId);
    c.value = change.value;
  } else if (change.kind === 'commander') p.commanderDamage[change.sourceId] = change.value;
  frame.eventIds.push(appendEvent(message, type, { playerId: p.id }));
  if (check && change.kind === 'counter' && change.counterKey === 'poison')
    checkEliminations(frame, p.id, ['poison']);
  pushFrame(frame);
  renderGame();
  showToast(message);
}
// Taps and holds are grouped: the total moves immediately, and one log entry / undo step is recorded after a short pause.
const LIFE_COMMIT_DELAY = 1400;
function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}
// Near-lethal warnings: low life (a quarter of starting life or less), 15+ commander damage from one source, 7+ poison.
function lowLifeLimit() {
  const g = currentGame();
  return Math.max(1, Math.ceil((Number(g?.startingLife) || 40) * 0.25));
}
function isLowLife(p) {
  return p.life >= 0 && p.life <= lowLifeLimit();
}
function lifeWarnMarkup(p) {
  return p.life < 0
    ? '<span class="life-warn neg">Below zero</span>'
    : isLowLife(p)
      ? '<span class="life-warn">Low life</span>'
      : '';
}
function lifeDeltaMarkup(p) {
  const pend = pendingLife[p.id];
  return pend && pend.delta
    ? `<div class="life-delta ${pend.delta < 0 ? 'down' : ''}">${signed(pend.delta)}</div>`
    : '';
}
function paintLife(playerId) {
  const p = getPlayer(playerId),
    ctrl = document.querySelector(`[data-life-control="${playerId}"]`);
  if (!p || !ctrl) return;
  const v = ctrl.querySelector('.life-value');
  if (v) {
    v.textContent = p.life;
    v.classList.toggle('negative', p.life < 0);
    v.classList.toggle('low', isLowLife(p));
  }
  ctrl.querySelector('.life-warn')?.remove();
  ctrl.insertAdjacentHTML('beforeend', lifeWarnMarkup(p));
  ctrl.setAttribute('aria-label', `Life total ${p.life}`);
  ctrl.querySelector('.life-delta')?.remove();
  ctrl.insertAdjacentHTML('beforeend', lifeDeltaMarkup(p));
  if (pendingLife[playerId]) {
    const u = $('#table-undo-btn');
    if (u) u.disabled = false;
  }
}
function bumpLife(playerId, delta) {
  const g = currentGame(),
    p = getPlayer(playerId);
  if (!g || !p) return;
  try {
    navigator.vibrate?.(Math.abs(delta) >= 10 ? 24 : 10);
  } catch (_) {}
  const pend = pendingLife[playerId] || (pendingLife[playerId] = { before: p.life, delta: 0, timer: null });
  p.life += delta;
  pend.delta += delta;
  clearTimeout(pend.timer);
  pend.timer = setTimeout(() => {
    commitPendingLife(playerId);
    renderGame();
  }, LIFE_COMMIT_DELAY);
  saveStore();
  paintLife(playerId);
  const mark = document.querySelector(
    `[data-life-control="${playerId}"] .life-mark.${delta < 0 ? 'minus' : 'plus'}`
  );
  if (mark) {
    mark.classList.remove('flash');
    void mark.offsetWidth;
    mark.classList.add('flash');
  }
}
function commitPendingLife(playerId) {
  const pend = pendingLife[playerId];
  if (!pend) return false;
  clearTimeout(pend.timer);
  delete pendingLife[playerId];
  const p = getPlayer(playerId);
  if (!p || !pend.delta || p.life === pend.before) return true;
  const d = p.life - pend.before;
  pushFrame({
    description: `${signed(d)} life for ${p.name}`,
    changes: [{ kind: 'life', playerId, before: pend.before }],
    eventIds: [
      appendEvent(`${signed(d)} life for ${p.name} · ${pend.before} → ${p.life}`, 'life', {
        playerId,
        lifeBefore: pend.before,
        lifeAfter: p.life
      })
    ]
  });
  return true;
}
function flushPendingLife() {
  let any = false;
  Object.keys(pendingLife).forEach(id => {
    if (commitPendingLife(id)) any = true;
  });
  return any;
}
function setExactLife(playerId, value) {
  const p = getPlayer(playerId);
  if (!p || !Number.isInteger(value)) return;
  const message = `Set ${p.name}'s life total from ${p.life} to ${value}`;
  doChange({ kind: 'life', playerId, value }, message, 'life');
}
function changeCounter(playerId, key, delta, counterId = null) {
  const p = getPlayer(playerId);
  if (!p) return;
  if (key === 'commander') {
    return openCommanderDamagePicker(playerId);
  }
  if (key === 'custom') {
    const c = p.counters.custom.find(c => c.id === counterId);
    if (!c) return;
    const value = Math.max(0, (c.value || 0) + delta);
    doChange(
      { kind: 'customCounter', playerId, counterId, value },
      `${delta > 0 ? '+' : ''}${delta} ${c.name} counter${Math.abs(delta) === 1 ? '' : 's'} for ${p.name}`,
      'counter'
    );
    return;
  }
  const label = COUNTER_META[key]?.label || key;
  const value = Math.max(0, (p.counters[key] || 0) + delta);
  doChange(
    { kind: 'counter', playerId, counterKey: key, value },
    `${delta > 0 ? '+' : ''}${delta} ${label} counter${Math.abs(delta) === 1 ? '' : 's'} for ${p.name}`,
    'counter'
  );
}
// Commander damage is keyed by source: "p2" for a player's commander, "p2:2" for their partner commander.
function sourceParts(key) {
  const [id, n] = String(key || '').split(':');
  return { id, partner: n === '2' };
}
function commanderSourceName(source, partner) {
  const c = partner ? source.commander2 : source.commander;
  return c ? `${source.name} (${c})` : partner ? `${source.name} (partner)` : source.name;
}
function commanderSources(p) {
  const g = currentGame();
  return (g?.players || [])
    .filter(q => q.id !== p.id)
    .flatMap(q =>
      q.partner
        ? [
            { key: q.id, source: q, partner: false },
            { key: `${q.id}:2`, source: q, partner: true }
          ]
        : [{ key: q.id, source: q, partner: false }]
    );
}
function changeCommanderDamage(targetId, sourceKey, delta) {
  const g = currentGame(),
    target = getPlayer(targetId),
    { id: sourceId, partner } = sourceParts(sourceKey),
    source = getPlayer(sourceId);
  if (!g || !target || !source) return;
  const beforeDamage = Number(target.commanderDamage[sourceKey] || 0),
    value = Math.max(0, beforeDamage + delta),
    actual = value - beforeDamage;
  if (!actual) return;
  const beforeLife = target.life,
    from = commanderSourceName(source, partner);
  target.commanderDamage[sourceKey] = value;
  target.life -= actual;
  const message = `${signed(actual)} commander damage to ${target.name} from ${from} · life ${beforeLife} → ${target.life}`;
  const frame = {
    description: `${signed(actual)} commander damage to ${target.name} from ${from}`,
    changes: [
      { kind: 'commander', playerId: targetId, sourceId: sourceKey, before: beforeDamage },
      { kind: 'life', playerId: targetId, before: beforeLife }
    ],
    eventIds: [
      appendEvent(message, 'commander', {
        playerId: target.id,
        sourceId: sourceKey,
        damage: actual,
        lifeBefore: beforeLife,
        lifeAfter: target.life
      })
    ]
  };
  if (actual > 0 && g.monarchPlayerId === target.id && !source.eliminated) {
    frame.changes.push({ kind: 'monarch', before: target.id });
    g.monarchPlayerId = source.id;
    frame.eventIds.push(
      appendEvent(
        `${source.name} became the Monarch after dealing commander damage to ${target.name}`,
        'monarch',
        { before: target.id, playerId: source.id, trigger: 'commander-damage' }
      )
    );
  }
  if (actual > 0) checkEliminations(frame, targetId, ['commander']);
  pushFrame(frame);
  renderGame();
}
function manualElimination(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  if (p.eliminated) {
    notify(`${p.name} is already eliminated`);
    return;
  }
  p.eliminated = true;
  p.eliminationReason = 'manual';
  const frame = {
    description: `Marked ${p.name} eliminated`,
    changes: [{ playerId: p.id, kind: 'elimination', before: false, beforeReason: null }],
    eventIds: [appendEvent(`${p.name} manually marked eliminated`, 'elimination', { playerId: p.id })]
  };
  handleMonarchLeaving(frame, [p.id]);
  handleInitiativeLeaving(frame, [p.id]);
  advanceIfCurrentEliminated(frame);
  pushFrame(frame);
}
function revivePlayer(playerId) {
  const p = getPlayer(playerId);
  if (!p || !p.eliminated) return;
  const beforeReason = p.eliminationReason || null;
  p.eliminated = false;
  p.eliminationReason = null;
  pushFrame({
    description: `Revived ${p.name}`,
    changes: [{ playerId: p.id, kind: 'elimination', before: true, beforeReason }],
    eventIds: [appendEvent(`${p.name} returned to the game`, 'elimination', { playerId: p.id })]
  });
}
function restoreFrameChange(ch) {
  if (ch.kind === 'turn') {
    const g = currentGame();
    if (!g) return;
    g.activePlayerId = ch.beforeActivePlayerId || null;
    g.turnStartedAt = g.activePlayerId
      ? clockNow(g) - Math.max(0, Number(ch.beforeTurnElapsedMs) || 0)
      : null;
    g.turnNumber = Math.max(1, Number(ch.beforeTurnNumber) || 1);
    return;
  }
  if (ch.kind === 'monarch') {
    const g = currentGame();
    if (g) g.monarchPlayerId = ch.before || null;
    return;
  }
  if (ch.kind === 'initiative') {
    const g = currentGame();
    if (g) g.initiativePlayerId = ch.before || null;
    return;
  }
  if (ch.kind === 'dungeon') {
    const p = getPlayer(ch.playerId);
    if (p) {
      p.dungeon = ch.before.dungeon;
      p.dungeonsCompleted = ch.before.completed;
      p.pendingRoom = ch.before.pending || null;
    }
    return;
  }
  if (ch.kind === 'seatOrder') {
    const g = currentGame();
    if (g) {
      g.seatOrder = (ch.beforeSeatOrder || g.players.map(p => p.id)).slice();
      g.turnOrder = (ch.beforeTurnOrder || turnOrderForSeats(g.seatOrder, g.turnDirection)).slice();
    }
    return;
  }
  const p = getPlayer(ch.playerId);
  if (!p) return;
  if (ch.kind === 'life') p.life = ch.before;
  else if (ch.kind === 'counter') p.counters[ch.counterKey] = ch.before;
  else if (ch.kind === 'customCounter') {
    const c = p.counters.custom.find(c => c.id === ch.counterId);
    if (c) c.value = ch.before;
  } else if (ch.kind === 'commander') p.commanderDamage[ch.sourceId] = ch.before;
  else if (ch.kind === 'commanderTax')
    p[ch.field === 'commanderTax2' ? 'commanderTax2' : 'commanderTax'] = ch.before;
  else if (ch.kind === 'elimination') {
    p.eliminated = ch.before;
    p.eliminationReason = ch.beforeReason || null;
  }
}
function undoLast() {
  const g = currentGame();
  if (!g) return;
  flushPendingLife();
  const frame = g.undoStack.pop();
  if (!frame) {
    notify('Nothing to undo yet', 'info');
    return;
  }
  [...(frame.changes || [])].reverse().forEach(restoreFrameChange);
  (frame.eventIds || []).forEach(id => {
    const e = g.events.find(e => e.id === id);
    if (e) e.undone = true;
  });
  appendEvent(`Undid ${frame.description}`, 'undo');
  saveStore();
  renderGame();
  notify(`Undid: ${frame.description}`, 'info');
}
function avatarMarkup(p) {
  if (p.avatar)
    return `<div class="avatar" style="--player-accent:${playerAccent(p)}"><img src="${esc(p.avatar)}" alt=""/></div>`;
  return `<div class="avatar" style="--player-accent:${playerAccent(p)}">${
    esc(
      (p.name || '?')
        .trim()
        .split(/\s+/)
        .map(w => w[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    ) || icon('user')
  }</div>`;
}
function miniAvatarMarkup(p) {
  const initials =
    esc(
      (p.name || '?')
        .trim()
        .split(/\s+/)
        .map(w => w[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    ) || '?';
  return `<span class="commander-source-avatar" style="--source-accent:${playerAccent(p)}">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : initials}</span>`;
}
function badgeMarkup(p) {
  const out = [];
  Object.entries(COUNTER_META).forEach(([key, m]) => {
    const n = p.counters[key] || 0;
    if (n > 0) {
      const near = key === 'poison' && n >= 7;
      out.push(
        `<button class="counter-badge${near ? ' near-lethal' : ''}" data-action="counter-badge" data-player-id="${p.id}" data-counter="${key}" aria-label="${m.label}: ${n}${near ? `, ${10 - n} from lethal` : ''}"${near ? ` title="${10 - n} poison from lethal"` : ''}><span class="badge-symbol">${m.symbol}</span><span>${n}</span>${near ? '<span class="warn-mark" aria-hidden="true">!</span>' : ''}</button>`
      );
    }
  });
  p.counters.custom.forEach(c => {
    if ((c.value || 0) > 0)
      out.push(
        `<button class="counter-badge" data-action="counter-badge" data-player-id="${p.id}" data-counter="custom" data-counter-id="${c.id}" aria-label="${esc(c.name)}: ${c.value}"><span class="badge-symbol">✦</span><span>${esc(c.name)} ${c.value}</span></button>`
      );
  });
  const g = currentGame();
  if (g?.initiativePlayerId === p.id)
    out.push(
      `<button class="counter-badge initiative-badge" data-action="dungeon-panel" data-player-id="${p.id}" aria-label="${esc(p.name)} has the initiative; open dungeon"><span class="badge-symbol">${icon('dungeon')}</span><span>Initiative</span></button>`
    );
  if (p.dungeon) {
    const d = DUNGEONS[p.dungeon.id],
      r = d.rooms[p.dungeon.room];
    out.push(
      `<button class="counter-badge dungeon-badge" data-action="dungeon-panel" data-player-id="${p.id}" title="${esc(d.name)}: ${esc(r.n)} — ${esc(r.t)}" aria-label="In ${esc(d.name)}, ${esc(r.n)}${p.pendingRoom ? '; a room effect is waiting' : ''}; open dungeon"><span class="badge-symbol">${icon('dungeon')}</span><span>${esc(r.n)}</span>${p.pendingRoom ? '<span class="warn-mark" aria-hidden="true">!</span>' : ''}</button>`
    );
  }
  if ((p.dungeonsCompleted || []).length)
    out.push(
      `<button class="counter-badge dungeon-badge" data-action="dungeon-panel" data-player-id="${p.id}" aria-label="${p.dungeonsCompleted.length} dungeons completed; open dungeon"><span class="badge-symbol">✓</span><span>${p.dungeonsCompleted.length} dungeon${p.dungeonsCompleted.length === 1 ? '' : 's'}</span></button>`
    );
  if (g?.monarchPlayerId === p.id)
    out.push(
      `<button class="counter-badge monarch-badge" data-action="monarch-picker" data-player-id="${p.id}" aria-label="${esc(p.name)} is the Monarch; change Monarch"><span class="badge-symbol">♛</span><span>Monarch</span></button>`
    );
  commanderSources(p)
    .filter(s => (Number(p.commanderDamage?.[s.key]) || 0) > 0)
    .forEach(s => {
      const n = Number(p.commanderDamage[s.key]) || 0,
        from = esc(commanderSourceName(s.source, s.partner));
      const near = n >= 15;
      out.push(
        `<button class="counter-badge commander-badge${near ? ' near-lethal' : ''}" data-action="commander-select" data-player-id="${p.id}" data-source-id="${s.key}" title="Commander damage from ${from}${near ? ` · ${21 - n} from lethal` : ''}" aria-label="${n} commander damage from ${from}${near ? `, ${21 - n} from lethal` : ''}">${miniAvatarMarkup(s.source)}${s.partner ? '<span class="partner-mark" style="--source-accent:' + playerAccent(s.source) + '">2</span>' : ''}<span>${n}</span>${near ? '<span class="warn-mark" aria-hidden="true">!</span>' : ''}</button>`
      );
    });
  // The tax badge only appears once tax has been paid; it stays reachable from the player menu.
  const tax = Math.max(0, Number(p.commanderTax) || 0),
    tax2 = p.partner ? Math.max(0, Number(p.commanderTax2) || 0) : 0;
  if (tax || tax2) {
    const shown = p.partner ? `${tax}/${tax2}` : `${tax}`;
    out.push(
      `<button class="counter-badge tax-badge" data-action="commander-tax" data-player-id="${p.id}" title="Commander tax: ${shown} additional generic mana" aria-label="Commander tax ${shown} for ${esc(p.name)}"><span class="badge-symbol">TAX</span><span>${shown}</span></button>`
    );
  }
  // Most important first (commander damage, poison, Monarch); past five badges the rest fold into a "+N" button.
  const rank = s =>
    s.includes('commander-badge')
      ? 0
      : s.includes('data-counter="poison"')
        ? 1
        : s.includes('monarch-badge') || s.includes('initiative-badge')
          ? 2
          : s.includes('dungeon-badge')
            ? 3
            : s.includes('tax-badge')
              ? 5
              : 4;
  out.sort((a, b) => rank(a) - rank(b));
  if (out.length > 5) {
    const hidden = out.length - 4;
    return (
      out.slice(0, 4).join('') +
      `<button class="counter-badge more-badge" data-action="manage-counters" data-player-id="${p.id}" aria-label="${hidden} more counters for ${esc(p.name)}">+${hidden}</button>`
    );
  }
  return out.join('');
}
function cardClass(p) {
  return `player-card ${p.eliminated ? 'eliminated' : ''} bg-${['slate', 'mana', 'light', 'prism'].includes(p.background) ? p.background : 'slate'}`;
}
function expandNarrowPanels() {
  const grid = $('#table-grid');
  if (!grid) return;
  const box = grid.getBoundingClientRect();
  $$('#table-grid .player-slot').forEach(slot => {
    const open = !!slot.querySelector('[data-card-panel-owner]');
    slot.classList.remove('panel-expanded');
    slot.style.removeProperty('--x');
    if (!open) return;
    const rot = Number(slot.dataset.rotation || 0),
      across = rot === 90 || rot === 270 ? slot.clientHeight : slot.clientWidth,
      tall = rot === 90 || rot === 270 ? slot.clientWidth : slot.clientHeight;
    if (across >= 260 && tall >= 230) return; // roomy enough: keep the menu in the card
    slot.classList.add('panel-expanded');
    Object.assign(slot.style, {
      top: box.top + 'px',
      left: box.left + 'px',
      width: box.width + 'px',
      height: box.height + 'px'
    });
  });
  $$('#table-grid .player-slot:not(.panel-expanded)').forEach(slot => {
    slot.style.top = slot.style.left = slot.style.width = slot.style.height = '';
  });
}
// Center hub: sits where the cards meet (nearest row/column boundary to the middle of the table).
function placeHub() {
  const hub = $('#table-hub'),
    grid = $('#table-grid'),
    shell = $('#screen-game .game-shell');
  if (!hub || !grid || !shell) return;
  const slots = $$('#table-grid .player-slot:not(.panel-expanded)');
  slots.forEach(sl => {
    const c = sl.querySelector('.player-card');
    if (c) {
      c.style.paddingTop = '';
      c.style.paddingBottom = '';
      c.style.paddingLeft = '';
      c.style.paddingRight = '';
    }
  });
  const gb = grid.getBoundingClientRect(),
    sb = shell.getBoundingClientRect(),
    rects = slots.map(sl => sl.getBoundingClientRect());
  if (!rects.length) return;
  const cx = gb.left + gb.width / 2,
    cy = gb.top + gb.height / 2;
  // a row boundary: below one card there is another card
  let y = cy,
    bestY = Infinity;
  rects.forEach(a =>
    rects.forEach(b => {
      if (
        b.top > a.bottom - 1 &&
        b.top - a.bottom < 30 &&
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 20
      ) {
        const m = (a.bottom + b.top) / 2;
        if (Math.abs(m - cy) < bestY) {
          bestY = Math.abs(m - cy);
          y = m;
        }
      }
    })
  );
  // a column boundary that exists at that height
  let x = cx,
    bestX = Infinity;
  rects.forEach(a =>
    rects.forEach(b => {
      if (
        b.left > a.right - 1 &&
        b.left - a.right < 30 &&
        a.top < y + 40 &&
        a.bottom > y - 40 &&
        b.top < y + 40 &&
        b.bottom > y - 40
      ) {
        const m = (a.right + b.left) / 2;
        if (Math.abs(m - cx) < bestX) {
          bestX = Math.abs(m - cx);
          x = m;
        }
      }
    })
  );
  // Use a seam only when one runs close to the middle (e.g. 2 or 4 columns); with 3 columns the true center
  // sits over the middle cards' name bars, which have room, and keeps the hub centered on the table.
  if (bestX === Infinity || bestX > gb.width * 0.08) x = cx;
  // Stack Undo above the clock button when the cards around the hub are turned sideways, so the hub
  // reaches along their edge instead of deep into them.
  const near = slots.filter((sl, i) => {
    const r = rects[i];
    return r.left < x + 40 && r.right > x - 40 && r.top < y + 40 && r.bottom > y - 40;
  });
  const sideways = near.filter(sl => [90, 270].includes(Number(sl.dataset.rotation))).length;
  hub.classList.toggle('stacked', sideways * 2 > near.length || (bestY === Infinity && bestX !== Infinity));
  hub.style.left = x - sb.left + shell.scrollLeft + 'px';
  hub.style.top = y - sb.top + shell.scrollTop + 'px';
  // Cards under the hub push their nearest content (header, or bottom rows) away from it.
  const hr = hub.getBoundingClientRect(),
    pad = 6,
    H = { l: hr.left - pad, r: hr.right + pad, t: hr.top - pad, b: hr.bottom + pad };
  slots.forEach((sl, i) => {
    const r = rects[i],
      card = sl.querySelector('.player-card');
    if (!card) return;
    const ix = {
      l: Math.max(r.left, H.l),
      r: Math.min(r.right, H.r),
      t: Math.max(r.top, H.t),
      b: Math.min(r.bottom, H.b)
    };
    if (ix.l >= ix.r || ix.t >= ix.b) return;
    const th = ((Number(sl.dataset.rotation) || 0) * Math.PI) / 180,
      co = Math.cos(th),
      si = Math.sin(th),
      W = card.offsetWidth,
      Hh = card.offsetHeight,
      scx = r.left + r.width / 2,
      scy = r.top + r.height / 2;
    const ys = [
      [ix.l, ix.t],
      [ix.r, ix.t],
      [ix.l, ix.b],
      [ix.r, ix.b]
    ].map(([px, py]) => {
      const dx = px - scx,
        dy = py - scy;
      return Hh / 2 + (-dx * si + dy * co);
    });
    const xs = [
      [ix.l, ix.t],
      [ix.r, ix.t],
      [ix.l, ix.b],
      [ix.r, ix.b]
    ].map(([px, py]) => {
      const dx = px - scx,
        dy = py - scy;
      return W / 2 + (dx * co + dy * si);
    });
    const lo = Math.min(...ys),
      hi = Math.max(...ys),
      xl = Math.min(...xs),
      xh = Math.max(...xs),
      cs = getComputedStyle(card);
    // Push content away along whichever direction costs the card the smallest share of its space: from the
    // top or bottom when the hub sits at an end, from the side when it bites into the middle of a tall card.
    const top = (lo + hi) / 2 < Hh / 2,
      vCost = (top ? hi : Hh - lo) / Hh,
      left = (xl + xh) / 2 < W / 2,
      hCost = (left ? xh : W - xl) / W;
    if (hCost < vCost && hCost < 0.3) {
      if (left) card.style.paddingLeft = Math.max(parseFloat(cs.paddingLeft), xh + 4) + 'px';
      else card.style.paddingRight = Math.max(parseFloat(cs.paddingRight), W - xl + 4) + 'px';
    } else if (top) card.style.paddingTop = Math.max(parseFloat(cs.paddingTop), hi + 4) + 'px';
    else card.style.paddingBottom = Math.max(parseFloat(cs.paddingBottom), Hh - lo + 4) + 'px';
  });
}
// Short cards show badges in one row: keep the most important ones that fit and fold the rest into "+N".
function fitBadges() {
  $$('#table-grid .card-foot .counter-row').forEach(row => {
    if (getComputedStyle(row).flexWrap !== 'nowrap') return;
    row.querySelectorAll('.badge-fold').forEach(x => x.remove());
    const badges = [...row.querySelectorAll('.counter-badge')];
    badges.forEach(b => b.classList.remove('hidden'));
    if (row.scrollWidth <= row.clientWidth + 1) return;
    const pid = row.closest('[data-player-id]')?.dataset.playerId;
    const fold = document.createElement('button');
    fold.type = 'button';
    fold.className = 'counter-badge more-badge badge-fold';
    fold.dataset.action = 'manage-counters';
    if (pid) fold.dataset.playerId = pid;
    row.appendChild(fold);
    let hidden = 0;
    for (let i = badges.length - 1; i >= 0 && row.scrollWidth > row.clientWidth + 1; i--) {
      if (badges[i].classList.contains('more-badge')) continue;
      badges[i].classList.add('hidden');
      hidden++;
      fold.textContent = '+' + hidden;
      fold.setAttribute('aria-label', `${hidden} more counters; open counters`);
    }
    if (!hidden) fold.remove();
  });
}
function fitRotatedCards() {
  requestAnimationFrame(() => {
    placeHub();
    fitBadges();
  });
  expandNarrowPanels();
  $$('#table-grid .player-slot').forEach(slot => {
    const card = slot.querySelector('.player-card');
    if (!card) return;
    const rotation = Number(slot.dataset.rotation || 0);
    if (rotation === 90 || rotation === 270) {
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      card.style.width = `${slot.clientHeight}px`;
      card.style.height = `${slot.clientWidth}px`;
      card.style.transform = `translate(-50%,-50%) rotate(${rotation}deg)`;
    } else {
      card.style.left = '0';
      card.style.top = '0';
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      card.style.width = '100%';
      card.style.height = '100%';
      card.style.transform = `rotate(${rotation}deg)`;
    }
  });
}
function cardPanelRoot(playerId) {
  return document.querySelector(`[data-card-panel-owner="${playerId}"]`);
}
function setCardPanel(playerId, type, extra = {}) {
  if (!getPlayer(playerId)) return;
  cardPanels[playerId] = { type, ...extra };
  renderGame();
}
function closeCardPanel(playerId) {
  delete cardPanels[playerId];
  delete customizeDrafts[playerId];
  delete avatarDrafts[playerId];
  renderGame();
}
function cardPanelHeader(p, state, title) {
  const back = ['menu', 'exact-life'].includes(state.type)
    ? ''
    : `<button type="button" class="card-tool-head-btn" data-action="back-card-panel" data-player-id="${p.id}" aria-label="Back to player menu">Menu</button>`;
  return `<div class="card-tool-header"><div class="card-tool-title">${esc(title)}</div><div class="card-tool-head-actions">${back}<button type="button" class="card-tool-head-btn" data-action="close-card-panel" data-player-id="${p.id}" aria-label="Close ${esc(title)}">${icon('x')}</button></div></div>`;
}
function renderCardTool(p, state) {
  let title = 'Player Menu',
    body = '';
  const type = state?.type || 'menu';
  if (type === 'menu') {
    const g = currentGame(),
      isMonarch = g?.monarchPlayerId === p.id,
      tax = p.partner
        ? `${Math.max(0, Number(p.commanderTax) || 0)}/${Math.max(0, Number(p.commanderTax2) || 0)}`
        : Math.max(0, Number(p.commanderTax) || 0);
    title = `${p.name} · Menu`;
    body = `<div class="card-tool-menu-grid">
  <button type="button" class="card-menu-tile" data-action="customize" data-player-id="${p.id}">${icon('palette')}<span>Customize</span></button>
  <button type="button" class="card-menu-tile" data-action="manage-counters" data-player-id="${p.id}">${icon('sliders')}<span>Counters</span></button>
  <button type="button" class="card-menu-tile" data-action="commander-picker" data-player-id="${p.id}">${icon('swords')}<span>Commander Damage</span></button>
  <button type="button" class="card-menu-tile" data-action="commander-tax" data-player-id="${p.id}">${icon('mana')}<span>Tax · ${tax}</span></button>
  <button type="button" class="card-menu-tile" data-action="monarch-picker" data-player-id="${p.id}">${icon('crown')}<span>${isMonarch ? 'Monarch ✓' : 'Monarch'}</span></button>
  <button type="button" class="card-menu-tile" data-action="dungeon-panel" data-player-id="${p.id}">${icon('dungeon')}<span>${p.dungeon ? 'Dungeon ·' : 'Dungeon'}${p.dungeon ? ' ' + esc(DUNGEONS[p.dungeon.id].rooms[p.dungeon.room].n) : ''}</span></button>
  <button type="button" class="card-menu-tile" data-action="dice" data-player-id="${p.id}">${icon('dice')}<span>Dice Roller</span></button>
  <button type="button" class="card-menu-tile" data-action="card-lookup" data-player-id="${p.id}">${icon('lookup')}<span>Look Up Card</span></button>
  <button type="button" class="card-menu-tile" data-action="exact-life" data-player-id="${p.id}">${icon('sliders')}<span>Set Life</span></button>
  ${p.eliminated ? `<button type="button" class="card-menu-tile" data-action="revive-player" data-player-id="${p.id}">${icon('sparkles')}<span>Revive</span></button>` : `<button type="button" class="card-menu-tile" data-action="confirm-eliminate" data-player-id="${p.id}">${icon('skull')}<span>Eliminate</span></button>`}
  </div>`;
  } else if (type === 'exact-life') {
    // The keypad lives inside the card, so it faces the player whichever way their card is rotated.
    title = `Set Life · now ${p.life}`;
    const entry = String(state.entry || ''),
      keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '⌫'];
    body = `<div class="keypad-display ${entry.startsWith('-') ? 'negative' : ''}" aria-live="polite">${entry === '' || entry === '-' ? `<span class="keypad-placeholder">${entry === '-' ? '−' : ''}${p.life}</span>` : esc(entry.replace('-', '−'))}</div><div class="keypad-grid">${keys.map(k => `<button type="button" class="keypad-key" data-action="keypad" data-player-id="${p.id}" data-key="${k}" aria-label="${k === '⌫' ? 'Delete' : k === '±' ? 'Toggle negative' : k}">${k}</button>`).join('')}</div><button type="button" class="card-tool-primary" style="margin-top:6px" data-action="keypad" data-player-id="${p.id}" data-key="set" ${/^-?\d+$/.test(entry) ? '' : 'disabled'}>${icon('check')} Set to ${/^-?\d+$/.test(entry) ? esc(entry.replace('-', '−')) : '…'}</button>`;
  } else if (type === 'confirm-eliminate') {
    title = 'Eliminate Player?';
    body = `<p class="card-tool-note" style="margin-top:0">Mark ${esc(p.name)} as out of the game? If it's their turn, the turn passes to the next player. You can Undo or Revive later.</p><button type="button" class="card-tool-danger" data-action="manual-eliminate" data-player-id="${p.id}">${icon('skull')} Eliminate ${esc(p.name)}</button><button type="button" class="card-tool-secondary" style="margin-top:6px" data-action="back-card-panel" data-player-id="${p.id}">Cancel</button>`;
  } else if (type === 'tax') {
    title = 'Commander Tax';
    const taxRow = (field, label) => {
      const value = Math.max(0, Number(p[field]) || 0);
      return `<div class="card-tool-row"><div class="card-tool-row-copy"><div class="card-tool-row-title">${label}</div><div class="card-tool-row-sub">+${value} generic mana</div></div><div class="card-tool-counter-controls"><button class="card-tool-counter-btn" data-action="commander-tax-change" data-player-id="${p.id}" data-field="${field}" data-delta="-2" aria-label="Decrease ${label} tax by two" ${value === 0 ? 'disabled' : ''}>−2</button><span class="card-tool-counter-value">${value}</span><button class="card-tool-counter-btn" data-action="commander-tax-change" data-player-id="${p.id}" data-field="${field}" data-delta="2" aria-label="Increase ${label} tax by two">+2</button></div></div>`;
    };
    body = `${taxRow('commanderTax', p.partner ? 'Commander' : 'Commander tax')}${p.partner ? taxRow('commanderTax2', 'Partner') : ''}<p class="card-tool-note">Increase by 2 each time a commander is cast from the command zone.${p.partner ? ' Partners each track their own tax.' : ''}</p>`;
  } else if (type === 'counters') {
    title = 'Counters';
    const builtins = Object.entries(COUNTER_META)
      .map(
        ([key, m]) =>
          `<div class="card-tool-row"><div class="card-tool-row-copy"><div class="card-tool-row-title"><span class="counter-symbol" style="--c:${m.color}">${m.symbol}</span> ${m.label}</div></div><div class="card-tool-counter-controls"><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="${key}" data-delta="-1" aria-label="Decrease ${m.label}">−</button><span class="card-tool-counter-value">${p.counters[key] || 0}</span><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="${key}" data-delta="1" aria-label="Increase ${m.label}">+</button></div></div>`
      )
      .join('');
    const custom = p.counters.custom
      .map(
        c =>
          `<div class="card-tool-row"><div class="card-tool-row-copy"><div class="card-tool-row-title">✦ ${esc(c.name)}</div></div><div class="card-tool-counter-controls"><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="custom" data-counter-id="${c.id}" data-delta="-1" aria-label="Decrease ${esc(c.name)}">−</button><span class="card-tool-counter-value">${c.value || 0}</span><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="custom" data-counter-id="${c.id}" data-delta="1" aria-label="Increase ${esc(c.name)}">+</button></div></div>`
      )
      .join('');
    body = `${builtins}${custom}<button type="button" class="card-tool-secondary" style="margin-top:7px" data-action="add-custom-counter" data-player-id="${p.id}">${icon('plus')} Add Custom Counter</button>`;
  } else if (type === 'counter') {
    let label, number, color, symbol;
    const key = state.counterKey;
    if (key === 'custom') {
      const c = p.counters.custom.find(c => c.id === state.counterId);
      if (!c) return renderCardTool(p, { type: 'counters' });
      label = c.name;
      number = c.value || 0;
      color = playerAccent(p);
      symbol = '✦';
    } else {
      const m = COUNTER_META[key];
      if (!m) return renderCardTool(p, { type: 'counters' });
      label = m.label;
      number = p.counters[key] || 0;
      color = m.color;
      symbol = m.symbol;
    }
    title = label;
    body = `<div style="text-align:center;padding:6px 0"><div style="font-size:17px;color:${color}">${symbol} ${esc(label)}</div><div class="card-tool-big-value" style="margin-top:8px">${number}</div></div><div class="card-tool-life-adjust"><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="${key}" ${state.counterId ? `data-counter-id="${state.counterId}"` : ''} data-delta="-1">−</button><button class="card-tool-counter-btn" data-action="counter-change" data-player-id="${p.id}" data-counter="${key}" ${state.counterId ? `data-counter-id="${state.counterId}"` : ''} data-delta="1">+</button></div><p class="card-tool-note">Each tap changes this value by 1.</p>`;
    if (key === 'custom')
      body += `<form data-form="rename-custom" data-player-id="${p.id}" data-counter-id="${state.counterId}"><label class="card-tool-label" for="rename-counter-${p.id}">Rename counter</label><div style="display:flex;gap:4px"><input class="card-tool-field" style="flex:1;min-width:0" aria-label="New counter name" id="rename-counter-${p.id}" name="counterName" maxlength="24" value="${esc(state.renameDraft ?? label)}" required><button type="submit" class="card-tool-mini-btn">Rename</button></div></form>${state.confirmDelete ? `<button type="button" class="card-tool-danger" data-action="delete-custom-counter" data-player-id="${p.id}" data-counter-id="${state.counterId}">Tap again to delete ${esc(label)}</button>` : `<button type="button" class="card-tool-secondary" style="margin-top:6px" data-action="ask-delete-custom-counter" data-player-id="${p.id}" data-counter-id="${state.counterId}">${icon('x')} Delete counter</button>`}`;
  } else if (type === 'commander-picker') {
    title = 'Commander Damage';
    body = `<p class="card-tool-note" style="margin-top:0">Choose whose commander dealt damage to ${esc(p.name)}.</p>${commanderSources(
      p
    )
      .map(
        s =>
          `<button type="button" class="card-tool-player-choice" data-action="commander-select" data-player-id="${p.id}" data-source-id="${s.key}">${miniAvatarMarkup(s.source)}<span class="card-tool-choice-copy"><span class="card-tool-choice-name">${esc(commanderSourceName(s.source, s.partner))}</span><span class="card-tool-choice-sub">Damage: ${Number(p.commanderDamage[s.key]) || 0}</span></span>${icon('chevron')}</button>`
      )
      .join('')}`;
  } else if (type === 'commander-value') {
    const { id: sourceId, partner } = sourceParts(state.sourceId),
      source = getPlayer(sourceId);
    if (!source) return renderCardTool(p, { type: 'commander-picker' });
    const key = state.sourceId,
      from = commanderSourceName(source, partner),
      n = Number(p.commanderDamage[key]) || 0;
    title = `Damage · ${from}`;
    body = `<div class="card-tool-player-choice">${miniAvatarMarkup(source)}<span class="card-tool-choice-copy"><span class="card-tool-choice-name">${esc(from)}</span><span class="card-tool-choice-sub">Commander damage to ${esc(p.name)}</span></span></div><div style="text-align:center;padding:7px 0"><div class="card-tool-big-value">${n}</div></div><div class="card-tool-life-adjust"><button class="card-tool-counter-btn" data-action="commander-change" data-player-id="${p.id}" data-source-id="${key}" data-delta="-1" aria-label="Decrease commander damage">−</button><button class="card-tool-counter-btn" data-action="commander-change" data-player-id="${p.id}" data-source-id="${key}" data-delta="1" aria-label="Increase commander damage">+</button></div><p class="card-tool-note">This damage also changes life total. 21 from one commander eliminates a player.</p>`;
  } else if (type === 'dungeon') {
    title = `${p.name} · Dungeon`;
    body = dungeonPanelBody(p);
  } else if (type === 'monarch') {
    title = 'Monarch Tracker';
    const g = currentGame();
    const options = g.players
      .filter(q => !q.eliminated)
      .map(
        q =>
          `<button type="button" class="card-tool-player-choice" data-action="set-monarch" data-player-id="${q.id}" data-host-id="${p.id}" style="border-color:${g.monarchPlayerId === q.id ? '#d9bd79' : '#ffffff12'}">${avatarMarkup(q)}<span class="card-tool-choice-copy"><span class="card-tool-choice-name">${esc(q.name)}${g.monarchPlayerId === q.id ? ' · Monarch' : ''}</span><span class="card-tool-choice-sub">${g.monarchPlayerId === q.id ? 'Currently holds the crown' : 'Make Monarch'}</span></span></button>`
      )
      .join('');
    body = `<p class="card-tool-note" style="margin-top:0">Assign or transfer the crown.</p>${options}<button type="button" class="card-tool-secondary" data-action="set-monarch" data-player-id="" data-host-id="${p.id}">${icon('x')} Clear Monarch</button>`;
  } else if (type === 'customize') {
    title = 'Customize Card';
    const d = customizeDrafts[p.id] || {
      name: p.name,
      theme: p.theme,
      color: playerAccent(p),
      background: p.background,
      rotation: p.rotation || 0,
      avatar: p.avatar || '',
      partner: !!p.partner
    };
    const safe = String(p.id).replace(/[^a-z0-9_-]/gi, '');
    const preview = d.avatar
      ? `<img src="${esc(d.avatar)}" alt="Avatar preview">`
      : esc(
          (d.name || p.name || '?')
            .trim()
            .split(/\s+/)
            .map(x => x[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase()
        );
    const themes = Object.entries(ACCENTS)
      .map(
        ([k, c]) =>
          `<button type="button" class="swatch ${d.theme === k ? 'selected' : ''}" title="${ACCENT_NAMES[k]} theme" aria-label="${ACCENT_NAMES[k]} theme" style="background:${c}" data-action="choose-player-theme" data-player-id="${p.id}" data-theme="${k}"></button>`
      )
      .join('');
    const selectedProfileId = state.selectedProfileId || d.selectedProfileId || '';
    const profiles = (store.savedProfiles || [])
      .map(
        sp =>
          `<option value="${sp.id}" ${selectedProfileId === sp.id ? 'selected' : ''}>${esc(sp.name)}</option>`
      )
      .join('');
    body = `<form class="card-tool-form" data-form="customize" data-player-id="${p.id}">
  <label class="card-tool-label" for="card-name-${safe}">Player name</label><input class="card-tool-field" id="card-name-${safe}" name="name" maxlength="32" value="${esc(d.name)}" required>
  <div class="card-tool-form-grid"><div><label class="card-tool-label" for="card-background-${safe}">Background</label><select class="card-tool-field" id="card-background-${safe}" name="background"><option value="slate" ${d.background === 'slate' ? 'selected' : ''}>Slate</option><option value="mana" ${d.background === 'mana' ? 'selected' : ''}>Glow</option><option value="prism" ${d.background === 'prism' ? 'selected' : ''}>Mana</option><option value="light" ${d.background === 'light' ? 'selected' : ''}>Light</option></select></div></div>
  <label class="card-tool-check"><input type="checkbox" name="partner" ${d.partner ? 'checked' : ''}> Partner commander (track damage and tax for two)</label>
  <label class="card-tool-label">Player color</label><div class="card-tool-swatches">${themes}</div><input class="card-tool-field" style="height:40px;padding:2px 4px;margin-top:5px" type="color" aria-label="Custom card color" name="color" data-player-color value="${/^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : ACCENTS[d.theme] || ACCENTS.blue}"><input type="hidden" name="theme" data-selected-player-theme value="${esc(d.theme)}"><input type="hidden" name="avatar" data-avatar-data value="${esc(d.avatar || '')}">
  <div style="display:flex;align-items:center;gap:7px;margin-top:7px"><div class="avatar-preview" data-avatar-preview>${preview}</div><div style="min-width:0;flex:1"><label class="card-tool-label" for="avatar-file-${safe}" style="margin-top:0">Avatar image</label><input class="card-tool-field" type="file" id="avatar-file-${safe}" accept="image/*" data-avatar-file><button type="button" class="card-tool-mini-btn" style="margin-top:4px" data-action="remove-avatar" data-player-id="${p.id}">Remove image</button></div></div>
  <label class="card-tool-label" for="saved-profile-select-${safe}">Load saved profile</label><div style="display:flex;gap:4px"><select class="card-tool-field" style="flex:1;min-width:0" aria-label="Saved profile" id="saved-profile-select-${safe}" data-saved-profile-select><option value="">Choose profile</option>${profiles}</select><button type="button" class="card-tool-mini-btn" data-action="load-profile" data-player-id="${p.id}">Load</button></div>
  <label class="card-tool-label" for="save-profile-name-${safe}">Save reusable profile</label><div style="display:flex;gap:4px"><input class="card-tool-field" id="save-profile-name-${safe}" aria-label="Profile name" data-save-profile-name maxlength="32" placeholder="Profile name" value="${esc(d.saveProfileName || '')}"><button type="button" class="card-tool-mini-btn" data-action="save-profile" data-player-id="${p.id}">Save</button></div><p class="card-tool-note" data-profile-status>Saving a profile lets you reuse this card later.</p>
  <button class="card-tool-primary" type="submit">Save Card</button></form>`;
  } else if (type === 'add-custom') {
    title = 'Add Custom Counter';
    body = `<form data-form="add-custom" data-player-id="${p.id}"><label class="card-tool-label" for="custom-counter-name-${p.id}">Counter name</label><input class="card-tool-field" id="custom-counter-name-${p.id}" name="counterName" maxlength="24" placeholder="e.g. Storm count" value="${esc(state.draftName || '')}" required><p class="card-tool-note">The counter starts at zero.</p><button class="card-tool-primary" style="margin-top:7px" type="submit">Add Counter</button></form>`;
  } else if (type === 'dice') {
    title = 'Dice Roller';
    const draft =
      diceDrafts[p.id] ||
      (diceDrafts[p.id] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false });
    if (draft.mode === 'percentile') draft.mode = 'die';
    const modes = [
      ['die', 'Dice'],
      ['coin', 'Coin'],
      ['custom', 'Custom']
    ];
    const sides = [4, 6, 8, 10, 12, 20];
    body = `<div class="card-tool-row-sub">Rolled by ${esc(p.name)} · logged automatically</div><div class="segmented" style="margin:6px 0">${modes.map(([k, l]) => `<button type="button" class="segment ${draft.mode === k ? 'selected' : ''}" style="padding:6px 8px;font-size:12px" data-action="dice-mode" data-player-id="${p.id}" data-mode="${k}">${l}</button>`).join('')}</div>`;
    if (draft.mode === 'die')
      body += `<div class="card-tool-dice-options">${sides.map(n => `<button type="button" class="die-option ${draft.sides === n ? 'selected' : ''}" data-action="dice-sides" data-player-id="${p.id}" data-sides="${n}"><span class="die-glyph">${icon('dice')}</span><span class="die-label">D${n}</span></button>`).join('')}</div>`;
    else if (draft.mode === 'custom')
      body += `<label class="card-tool-label" for="custom-die-sides-${p.id}">Number of sides</label><input class="card-tool-field" id="custom-die-sides-${p.id}" type="number" min="2" max="100000" value="${draft.sides}" data-action="custom-die-side-input" data-player-id="${p.id}">`;
    else body += `<p class="card-tool-note">Heads or tails.</p>`;
    const qLabel = draft.mode === 'coin' ? 'Flips' : 'Dice';
    body += `<div style="display:flex;align-items:center;gap:5px;margin-top:6px"><span class="card-tool-label" style="margin:0;flex:1">${qLabel} (1–20)</span><button class="card-tool-counter-btn" data-action="dice-count-step" data-player-id="${p.id}" data-delta="-1">−</button><span class="card-tool-counter-value">${draft.count}</span><button class="card-tool-counter-btn" data-action="dice-count-step" data-player-id="${p.id}" data-delta="1">+</button></div>`;
    const rs = draft.last?.results || [];
    body += `<div class="card-tool-dice-result" data-dice-result-area>${draft.rolling ? Array.from({ length: draft.count }, (_, i) => (draft.mode === 'coin' ? `<div class="card-tool-coin flipping" style="animation-delay:${i * 60}ms"><span class="coin-face">${icon('coin')}</span></div>` : `<div class="card-tool-die-result rolling">${icon('dice')}</div>`)).join('') : rs.length ? rs.map(r => (draft.last?.mode === 'coin' ? `<div class="card-tool-coin landed ${r === 'Heads' ? 'heads' : 'tails'}" role="img" aria-label="${esc(r)}" title="${esc(r)}"><span class="coin-face">${r === 'Heads' ? 'H' : 'T'}</span></div>` : `<div class="card-tool-die-result">${esc(r)}</div>`)).join('') : '<span class="card-tool-note">Result appears here.</span>'}${!draft.rolling && draft.last?.total !== undefined ? `<div class="card-tool-dice-total">Total: <strong>${draft.last.total}</strong></div>` : ''}${!draft.rolling && draft.last?.mode === 'coin' && rs.length ? `<div class="card-tool-dice-total">Heads <strong>${rs.filter(r => r === 'Heads').length}</strong> · Tails <strong>${rs.filter(r => r === 'Tails').length}</strong></div>` : ''}</div><button type="button" class="card-tool-primary" data-action="roll-dice" data-player-id="${p.id}" ${draft.rolling ? 'disabled' : ''}>${draft.mode === 'coin' ? `${icon('coin')} ${draft.last?.mode === 'coin' ? 'Flip Again' : 'Flip Coin'}${draft.count > 1 ? 's' : ''}` : `${icon('dice')} ${draft.last && draft.last.mode !== 'coin' ? 'Roll Again' : 'Roll Dice'}`}</button>`;
  }
  return `<div class="card-tool-shell" data-card-panel-owner="${p.id}" data-card-panel-type="${type}">${cardPanelHeader(p, state, title)}<div class="card-tool-body" data-card-tool-body>${body}</div></div>`;
}
function renderGame() {
  const g = currentGame();
  if (!g) return;
  const shell = $('#screen-game .game-shell');
  const viewState = {
    shellTop: shell?.scrollTop || 0,
    windowX: window.scrollX || 0,
    windowY: window.scrollY || 0
  };
  $$('#table-grid [data-card-panel-owner]').forEach(panel => {
    const body = panel.querySelector('[data-card-tool-body]');
    if (body) {
      const key = `${panel.dataset.cardPanelOwner}:${panel.dataset.cardPanelType}`;
      cardToolScrollPositions[key] = body.scrollTop;
    }
  });
  // Keep whoever is typing in a card's form focused (with their cursor) when another player's action redraws the table.
  const focused = document.activeElement,
    focusState =
      focused && focused.id && focused.closest?.('#table-grid')
        ? {
            id: focused.id,
            start: (() => {
              try {
                return focused.selectionStart;
              } catch (_) {
                return null;
              }
            })(),
            end: (() => {
              try {
                return focused.selectionEnd;
              } catch (_) {
                return null;
              }
            })()
          }
        : null;
  ensureTurnState(g);
  updateGameClocks();
  const undoBtn = $('#table-undo-btn');
  if (undoBtn) undoBtn.disabled = !(g.undoStack.length || Object.keys(pendingLife).length);
  const grid = $('#table-grid'),
    layout = gameLayout(g);
  grid.className = `table-grid layout-grid layout-${layout.id}${g.timerStarted && g.activePlayerId ? ' turns-on' : ''}`;
  grid.style.gridTemplateAreas = layout.areas.map(r => `"${r}"`).join(' ');
  grid.style.gridTemplateColumns =
    layout.cols || `repeat(${layout.areas[0].split(' ').length},minmax(0,1fr))`;
  grid.style.gridTemplateRows = layout.rows || `repeat(${layout.areas.length},minmax(0,1fr))`;
  const seats = normalizedSeatOrder(g);
  const visualPlayers = seats.map(id => g.players.find(p => p.id === id)).filter(Boolean);
  grid.innerHTML = visualPlayers
    .map((p, seatIndex) => {
      p.rotation = seatRotation(g, seatIndex);
      const seatArea = layout.seats[seatIndex]?.[0] || 'auto';
      const active = !!g.timerStarted && p.id === g.activePlayerId && !p.eliminated;
      let cardContent = '';
      // Cards carry only per-player controls; Undo, the log and End Game live in the top bar.
      const cmdrNames = [p.commander, p.partner ? p.commander2 : ''].filter(Boolean);
      const header = `<header class="player-header">${avatarMarkup(p)}<div class="player-name" title="${esc(p.name)}"><span class="pn">${esc(p.name)}</span>${cmdrNames.length ? `<span class="cmdr-line" title="${esc(cmdrNames.join(' & '))}">${esc(cmdrNames.join(' & '))}</span>` : ''}</div><div class="player-header-spacer"></div><div class="player-tools">
  <button class="tool-btn seat-drag-handle" data-action="drag-seat" data-player-id="${p.id}" title="Drag to swap seats" aria-label="Drag ${esc(p.name)} to swap seats">${icon('grip')}</button>
  <button class="tool-btn" data-action="player-menu" data-player-id="${p.id}" title="Player menu" aria-label="Player menu for ${esc(p.name)}">${icon('grid')}</button>
  </div></header>`;
      if (cardPanels[p.id]) cardContent = renderCardTool(p, cardPanels[p.id]);
      else if (p.eliminated) {
        const reason =
          {
            poison: '10 poison counters',
            'commander damage': '21 damage from one commander',
            manual: 'Marked out of the game'
          }[p.eliminationReason] || 'Out of the game';
        cardContent = `${header}<div class="eliminated-panel"><div class="eliminated-icon">${icon('skull')}</div><div class="eliminated-title">Eliminated</div><div class="eliminated-reason">${reason} · final life ${p.life}</div><button type="button" class="eliminated-revive" data-action="revive-player" data-player-id="${p.id}">${icon('sparkles')} Revive</button></div>`;
      } else
        cardContent = `${header}
  <div class="life-control" data-life-control="${p.id}" aria-label="Life total ${p.life}"><span class="life-mark minus" aria-hidden="true">−</span><span class="life-mark plus" aria-hidden="true">+</span>
   <button class="life-zone left" data-life-zone="left" data-player-id="${p.id}" aria-label="Decrease ${esc(p.name)} life by one, hold to decrease by ten"></button>
   <button class="life-zone center" data-life-zone="center" data-player-id="${p.id}" aria-label="Set exact life total for ${esc(p.name)}; press and hold for commander damage"></button>
   <button class="life-zone right" data-life-zone="right" data-player-id="${p.id}" aria-label="Increase ${esc(p.name)} life by one, hold to increase by ten"></button>
   <div class="life-value ${p.life < 0 ? 'negative' : ''} ${isLowLife(p) ? 'low' : ''}">${p.life}</div>${lifeDeltaMarkup(p)}${lifeWarnMarkup(p)}
  </div>
  <div class="card-foot"><div class="turn-row">${active ? `<div class="turn-clock"><span class="turn-time" data-turn-elapsed="${p.id}">${formatDuration(clockNow(g) - (g.turnStartedAt || clockNow(g)))}</span></div><button class="pass-turn-btn" data-action="pass-turn" data-player-id="${p.id}" aria-label="Pass turn from ${esc(p.name)}">Pass Turn ${icon('chevron')}</button>` : ''}</div>
  <div class="counter-row">${badgeMarkup(p)}</div></div>`;
      return `<div class="player-slot rot-${p.rotation || 0}" style="grid-area:${seatArea}" data-player-slot data-player-id="${p.id}" data-rotation="${p.rotation || 0}"><article class="${cardClass(p)} ${active ? 'is-active-turn' : ''}" data-player-card="${p.id}" style="--player-accent:${playerAccent(p)}">${cardContent}</article></div>`;
    })
    .join('');
  if (focusState) {
    const el = document.getElementById(focusState.id);
    if (el) {
      el.focus({ preventScroll: true });
      try {
        if (focusState.start !== null) el.setSelectionRange(focusState.start, focusState.end);
      } catch (_) {}
    }
  }
  requestAnimationFrame(() => {
    fitRotatedCards();
    if (shell) shell.scrollTop = viewState.shellTop;
    $$('#table-grid [data-card-panel-owner]').forEach(panel => {
      const body = panel.querySelector('[data-card-tool-body]');
      if (body) {
        const key = `${panel.dataset.cardPanelOwner}:${panel.dataset.cardPanelType}`;
        body.scrollTop = Number(cardToolScrollPositions[key] || 0);
      }
    });
    window.scrollTo?.(viewState.windowX, viewState.windowY);
    requestAnimationFrame(() => {
      if (shell) shell.scrollTop = viewState.shellTop;
      $$('#table-grid [data-card-panel-owner]').forEach(panel => {
        const body = panel.querySelector('[data-card-tool-body]');
        if (body) {
          const key = `${panel.dataset.cardPanelOwner}:${panel.dataset.cardPanelType}`;
          body.scrollTop = Number(cardToolScrollPositions[key] || 0);
        }
      });
      window.scrollTo?.(viewState.windowX, viewState.windowY);
    });
  });
  updateGameClocks();
}
function swapSeatPositions(sourceId, targetId) {
  const g = currentGame();
  if (!g || !sourceId || !targetId || sourceId === targetId) return;
  const seats = normalizedSeatOrder(g).slice(),
    beforeSeatOrder = seats.slice(),
    sourceIndex = seats.indexOf(sourceId),
    targetIndex = seats.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const beforeTurnOrder = (g.turnOrder || []).slice();
  [seats[sourceIndex], seats[targetIndex]] = [seats[targetIndex], seats[sourceIndex]];
  g.seatOrder = seats;
  g.turnOrder = turnOrderForSeats(seats, g.turnDirection);
  const source = getPlayer(sourceId),
    target = getPlayer(targetId);
  // Rotation comes from the seat, so each card automatically faces the edge it moved to.
  const message = `Seat swap · ${source?.name || sourceId} and ${target?.name || targetId}`;
  const eventId = appendEvent(message, 'seating', { playerId: sourceId, targetPlayerId: targetId });
  pushFrame({
    description: message,
    changes: [{ kind: 'seatOrder', beforeSeatOrder, beforeTurnOrder }],
    eventIds: [eventId]
  });
  renderGame();
}
function setGameLayout(id) {
  const g = currentGame();
  if (!g) return;
  const layout = layoutFor(g.players.length, id);
  if (layout.id !== g.layout) {
    g.layout = layout.id;
    g.turnOrder = turnOrderForSeats(normalizedSeatOrder(g), g.turnDirection);
    store.lastSetup = {
      ...(store.lastSetup || {}),
      layouts: { ...(store.lastSetup?.layouts || {}), [g.players.length]: layout.id }
    };
    appendEvent(`Table layout changed · ${layout.label}`, 'seating');
    saveStore();
  }
  closeModal();
  renderGame();
}
function openLayoutPicker() {
  const g = currentGame();
  if (!g) return;
  openModal(
    'Table Layout',
    `<p class="modal-note">Choose how players are seated around the device. The colored edge shows where each player sits; numbers show the seats in clockwise order. The table adjusts when you turn the device. Drag a card's handle to swap seats.</p><div class="layout-options">${layoutOptionsMarkup(g.players.length, g.layout, 'set-game-layout')}</div>`,
    true
  );
}
function handleSeatDragStart(e) {
  const handle = e.target.closest('[data-action="drag-seat"]');
  if (!handle || e.button !== 0) return;
  const slot = handle.closest('[data-player-slot]');
  if (!slot) return;
  e.preventDefault();
  if (seatDragState) cancelSeatDrag();
  seatDragState = {
    sourceId: slot.dataset.playerId,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    sourceSlot: slot,
    targetId: slot.dataset.playerId
  };
  slot.classList.add('dragging');
  document.body.classList.add('seat-drag-active');
  try {
    handle.setPointerCapture(e.pointerId);
  } catch (_) {}
}
function handleSeatDragMove(e) {
  const d = seatDragState;
  if (!d || e.pointerId !== d.pointerId) return;
  if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 7) return;
  d.moved = true;
  const at = document.elementFromPoint(e.clientX, e.clientY);
  const targetSlot = at?.closest('[data-player-slot]');
  $$('#table-grid .player-slot').forEach(slot =>
    slot.classList.toggle(
      'drop-target',
      !!targetSlot && slot === targetSlot && slot.dataset.playerId !== d.sourceId
    )
  );
  d.targetId = targetSlot?.dataset.playerId || d.sourceId;
}
function cleanupSeatDrag() {
  if (seatDragState?.pointerId !== undefined) {
    try {
      const active = document.querySelector('[data-action="drag-seat"]:active');
      active?.releasePointerCapture?.(seatDragState.pointerId);
    } catch (_) {}
  }
  $$('#table-grid .player-slot').forEach(slot => slot.classList.remove('dragging', 'drop-target'));
  document.body.classList.remove('seat-drag-active');
  seatDragState = null;
}
function finishSeatDrag(e) {
  const d = seatDragState;
  if (!d) return;
  if (e && e.pointerId !== undefined && e.pointerId !== d.pointerId) return;
  let targetId = d.targetId;
  if (e && d.moved) {
    const at = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = at?.closest('[data-player-slot]');
    if (targetSlot) targetId = targetSlot.dataset.playerId;
  }
  cleanupSeatDrag();
  if (d.moved && targetId && targetId !== d.sourceId) swapSeatPositions(d.sourceId, targetId);
}
function cancelSeatDrag(e) {
  if (!seatDragState) return;
  if (e?.pointerId !== undefined && e.pointerId !== seatDragState.pointerId) return;
  cleanupSeatDrag();
}
let lastUpright = isUpright();
window.addEventListener('resize', () => {
  const up = isUpright();
  if (up !== lastUpright) {
    lastUpright = up;
    if (currentScreen === 'game' && currentGame()) renderGame();
    else if (currentScreen === 'setup') renderSetup();
    if ($('#modal-backdrop').classList.contains('open') && $('#dialog-title')?.textContent === 'Table Layout')
      openLayoutPicker();
  }
  requestAnimationFrame(fitRotatedCards);
});
function persistProfiles() {
  if (currentGame()) syncProfiles(currentGame().players);
  saveStore();
}
var modalOpener = null;
function openModal(title, body, wide = false) {
  if (!$('#modal-backdrop').classList.contains('open')) modalOpener = document.activeElement;
  document.querySelectorAll('.screen').forEach(sc => (sc.inert = true));
  $('#dialog').classList.toggle('wide', wide);
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = body;
  $('#modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  const first = $('#dialog-body input:not([type=file]),#dialog-body button,#dialog-body select');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 20);
}
function closeModal() {
  const wasOpen = $('#modal-backdrop').classList.contains('open');
  $('#modal-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  document.querySelectorAll('.screen').forEach(sc => (sc.inert = false));
  if (wasOpen && modalOpener && document.contains(modalOpener)) modalOpener.focus({ preventScroll: true });
  modalOpener = null;
}
function openCommanderTax(playerId, backTo = 'menu') {
  const p = getPlayer(playerId);
  if (!p) return;
  setCardPanel(playerId, 'tax', { backTo });
}
function changeCommanderTax(playerId, delta, field = 'commanderTax') {
  const p = getPlayer(playerId);
  if (!p) return;
  field = field === 'commanderTax2' ? 'commanderTax2' : 'commanderTax';
  const before = Math.max(0, Number(p[field]) || 0),
    value = Math.max(0, before + delta);
  if (value === before) return;
  p[field] = value;
  const message = `${field === 'commanderTax2' ? 'Partner tax' : 'Commander tax'} for ${p.name}: ${before} → ${value}`;
  const eventId = appendEvent(message, 'commander-tax', { playerId: p.id, field, before, value });
  pushFrame({
    description: message,
    changes: [{ kind: 'commanderTax', playerId: p.id, field, before }],
    eventIds: [eventId]
  });
  renderGame();
}
function deleteCustomCounter(playerId, counterId) {
  const p = getPlayer(playerId);
  if (!p) return;
  const c = p.counters.custom.find(c => c.id === counterId);
  if (!c) return;
  p.counters.custom = p.counters.custom.filter(x => x.id !== counterId);
  appendEvent(`${p.name} removed the ${c.name} counter (was ${c.value || 0})`, 'counter', { playerId: p.id });
  saveStore();
  cardPanels[playerId] = { type: 'counters', backTo: 'menu' };
  renderGame();
}
function renameCustomCounter(playerId, counterId, name) {
  const p = getPlayer(playerId);
  if (!p) return;
  const c = p.counters.custom.find(c => c.id === counterId);
  if (!c) return;
  name = String(name || '')
    .trim()
    .slice(0, 24);
  if (!name) {
    notify('Enter a counter name');
    return;
  }
  if (p.counters.custom.some(x => x.id !== counterId && x.name.toLowerCase() === name.toLowerCase())) {
    notify('That custom counter already exists');
    return;
  }
  if (name !== c.name) {
    appendEvent(`${p.name} renamed the ${c.name} counter to ${name}`, 'counter', { playerId: p.id });
    c.name = name;
    saveStore();
  }
  cardPanels[playerId] = { type: 'counter', counterKey: 'custom', counterId, backTo: 'counters' };
  renderGame();
}
function dungeonSnapshot(p) {
  return {
    dungeon: p.dungeon ? { ...p.dungeon } : null,
    completed: (p.dungeonsCompleted || []).slice(),
    pending: p.pendingRoom ? { ...p.pendingRoom } : null
  };
}
// Venture into the dungeon: enter the chosen dungeon if not in one, otherwise move to the chosen next room.
// Entering a dungeon's last room completes it (its room ability still resolves).
function venture(playerId, { dungeonId = null, roomId = null, frame = null, reason = '' } = {}) {
  const g = currentGame(),
    p = getPlayer(playerId);
  if (!g || !p) return;
  const own = !frame;
  frame = frame || { description: '', changes: [], eventIds: [] };
  frame.changes.push({ kind: 'dungeon', playerId, before: dungeonSnapshot(p) });
  let d, room;
  const entering = !p.dungeon;
  if (!p.dungeon) {
    d = DUNGEONS[dungeonId];
    if (!d) return;
    room = d.start;
    p.dungeon = { id: dungeonId, room };
  } else {
    d = DUNGEONS[p.dungeon.id];
    const cur = d.rooms[p.dungeon.room];
    room = roomId && cur.next.includes(roomId) ? roomId : cur.next[0];
    if (!room) return;
    p.dungeon = { id: p.dungeon.id, room };
  }
  const r = d.rooms[room];
  let msg = entering
    ? `${p.name}${reason} entered ${d.name}: ${r.n} — ${r.t}`
    : `${p.name}${reason} ventured to ${r.n} (${d.name}) — ${r.t}`;
  if (!r.next.length) {
    p.dungeonsCompleted = [...(p.dungeonsCompleted || []), d.name];
    p.dungeon = null;
    msg += ` · Completed ${d.name}`;
  }
  frame.eventIds.push(appendEvent(msg, 'dungeon', { playerId }));
  frame.description = frame.description || `${p.name} ventured to ${r.n}`;
  if (r.life) applyRoomLife(p, r, frame);
  if (r.choice) {
    p.pendingRoom = { dungeon: d.name, room: r.n, ...r.choice };
    cardPanels[playerId] = { type: 'dungeon', backTo: 'menu' };
  }
  if (own) {
    pushFrame(frame);
    saveStore();
  }
  return frame;
}
// Taking the initiative ventures into Undercity (or advances the dungeon you're already in).
// Life changes from a room, recorded in the same undo step as the venture.
function changeLifeIn(frame, q, delta) {
  frame.changes.push({ kind: 'life', playerId: q.id, before: q.life });
  q.life += delta;
  return `${q.name} ${delta > 0 ? 'gained' : 'lost'} ${Math.abs(delta)} life (${q.life})`;
}
function applyRoomLife(p, r, frame) {
  const g = currentGame(),
    alive = g.players.filter(q => !q.eliminated),
    lines = [];
  if (r.life.all) alive.forEach(q => lines.push(changeLifeIn(frame, q, r.life.all)));
  if (r.life.opp)
    alive.filter(q => q.id !== p.id).forEach(q => lines.push(changeLifeIn(frame, q, r.life.opp)));
  if (r.life.you) lines.push(changeLifeIn(frame, p, r.life.you));
  if (lines.length) {
    frame.eventIds.push(appendEvent(`${r.n}: ${lines.join(', ')}`, 'life'));
    lifeNotice(
      `${r.n}: ${lines.join(' · ')}`,
      alive.filter(q => lines.some(l => l.startsWith(q.name + ' '))).map(q => q.id)
    );
  }
}
// A pop-up everyone can read, plus a brief flash on the life totals that changed.
function lifeNotice(message, playerIds = []) {
  const t = $('#toast');
  if (t) {
    t.textContent = message;
    t.classList.remove('error');
    t.classList.add('show', 'life-notice');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show', 'life-notice'), 4200);
  }
  setTimeout(
    () =>
      playerIds.forEach(id => {
        const v = document.querySelector(`[data-life-control="${id}"] .life-value`);
        if (v) {
          v.classList.remove('life-flash');
          void v.offsetWidth;
          v.classList.add('life-flash');
        }
      }),
    60
  );
}
// Rooms that need a choice: Trap! (pick a target) and Veils of Fear / Sandfall Cell (who paid instead).
function resolveRoomChoice(playerId, { targetId = null, payers = [], skip = false } = {}) {
  const g = currentGame(),
    p = getPlayer(playerId);
  const pend = p?.pendingRoom;
  if (!g || !pend) return;
  const frame = {
    description: `${pend.room} for ${p.name}`,
    changes: [{ kind: 'dungeon', playerId, before: dungeonSnapshot(p) }],
    eventIds: []
  };
  p.pendingRoom = null;
  const lines = [],
    hit = [];
  if (!skip && pend.kind === 'target') {
    const q = getPlayer(targetId);
    if (q) {
      lines.push(changeLifeIn(frame, q, -pend.amount));
      hit.push(q.id);
    }
  }
  if (!skip && pend.kind === 'each')
    g.players
      .filter(q => !q.eliminated && !payers.includes(q.id))
      .forEach(q => {
        lines.push(changeLifeIn(frame, q, -pend.amount));
        hit.push(q.id);
      });
  const paid = g.players.filter(q => payers.includes(q.id)).map(q => q.name);
  const msg = skip
    ? `${pend.room}: resolved without changing life`
    : `${pend.room}: ${lines.join(', ') || 'no one lost life'}${paid.length ? ` · ${paid.join(', ')}: ${pend.instead.toLowerCase()}` : ''}`;
  frame.eventIds.push(appendEvent(msg, 'life'));
  pushFrame(frame);
  saveStore();
  if (!skip && hit.length) lifeNotice(msg.replace(/, /g, ' · '), hit);
}
function takeInitiative(playerId) {
  const g = currentGame(),
    p = getPlayer(playerId);
  if (!g || !p || p.eliminated) return;
  if (g.initiativePlayerId === playerId) {
    ventureUndercity(playerId);
    return;
  }
  const frame = {
    description: `${p.name} took the initiative`,
    changes: [{ kind: 'initiative', before: g.initiativePlayerId || null }],
    eventIds: []
  };
  g.initiativePlayerId = playerId;
  frame.eventIds.push(appendEvent(`${p.name} took the initiative`, 'dungeon', { playerId }));
  venture(playerId, { dungeonId: 'undercity', frame, reason: ' (initiative)' });
  pushFrame(frame);
  saveStore();
}
function ventureUndercity(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  venture(playerId, { dungeonId: 'undercity', reason: ' (initiative, upkeep)' });
}
function clearInitiative() {
  const g = currentGame();
  if (!g || !g.initiativePlayerId) return;
  const before = g.initiativePlayerId;
  g.initiativePlayerId = null;
  pushFrame({
    description: 'Initiative cleared',
    changes: [{ kind: 'initiative', before }],
    eventIds: [appendEvent('The initiative was cleared', 'dungeon')]
  });
  saveStore();
}
function leaveDungeon(playerId) {
  const p = getPlayer(playerId);
  if (!p || !p.dungeon) return;
  const d = DUNGEONS[p.dungeon.id];
  pushFrame({
    description: `${p.name} left ${d.name}`,
    changes: [{ kind: 'dungeon', playerId, before: dungeonSnapshot(p) }],
    eventIds: [appendEvent(`${p.name} was removed from ${d.name}`, 'dungeon', { playerId })]
  });
  p.dungeon = null;
  saveStore();
}
// If the player with the initiative leaves the game, the next player in turn order takes it.
function handleInitiativeLeaving(frame, eliminatedIds) {
  const g = currentGame();
  if (!g || !g.initiativePlayerId || !eliminatedIds.includes(g.initiativePlayerId)) return;
  const oldId = g.initiativePlayerId,
    order = g.turnOrder || g.players.map(p => p.id);
  const start = order.indexOf(oldId);
  let next = null;
  for (let step = 1; step < order.length; step++) {
    const c = g.players.find(p => p.id === order[(start + step) % order.length]);
    if (c && !c.eliminated) {
      next = c;
      break;
    }
  }
  frame.changes.push({ kind: 'initiative', before: oldId });
  g.initiativePlayerId = next?.id || null;
  if (next) {
    frame.eventIds.push(
      appendEvent(
        `${next.name} took the initiative because ${getPlayer(oldId)?.name || 'its holder'} left the game`,
        'dungeon',
        { playerId: next.id }
      )
    );
    venture(next.id, { dungeonId: 'undercity', frame, reason: ' (initiative)' });
  } else frame.eventIds.push(appendEvent('No eligible player remains to take the initiative', 'dungeon'));
}
function roomChoiceMarkup(p) {
  const g = currentGame(),
    pend = p.pendingRoom;
  if (!pend) return '';
  const alive = g.players.filter(q => !q.eliminated);
  if (pend.kind === 'target')
    return `<div class="dg-pending" role="group" aria-label="${esc(pend.room)}: choose a target"><p class="dg-pending-title">${esc(pend.room)}: choose who loses ${pend.amount} life</p><div class="dg-targets">${alive.map(q => `<button type="button" class="card-tool-player-choice" data-action="room-target" data-player-id="${p.id}" data-target-id="${q.id}">${avatarMarkup(q)}<span class="card-tool-choice-copy"><span class="card-tool-choice-name">${esc(q.name)}${q.id === p.id ? ' (you)' : ''}</span><span class="card-tool-choice-sub">${q.life} → ${q.life - pend.amount}</span></span></button>`).join('')}</div><button type="button" class="card-tool-secondary" data-action="room-skip" data-player-id="${p.id}">Skip (handled at the table)</button></div>`;
  return `<div class="dg-pending" role="group" aria-label="${esc(pend.room)}: who paid instead"><p class="dg-pending-title">${esc(pend.room)}: each player loses ${pend.amount} life unless they paid. Tap anyone who paid instead.</p><div class="dg-payers">${alive.map(q => `<label class="dg-payer"><input type="checkbox" data-room-payer="${q.id}"><span class="dg-payer-copy"><span class="dg-payer-name">${esc(q.name)}</span><span class="dg-payer-state" aria-hidden="true"></span></span></label>`).join('')}</div><button type="button" class="card-tool-primary" data-action="room-apply" data-player-id="${p.id}">Apply life loss</button><button type="button" class="card-tool-secondary" data-action="room-skip" data-player-id="${p.id}">Skip (handled at the table)</button></div>`;
}
function dungeonPanelBody(p) {
  const g = currentGame(),
    hasInit = g?.initiativePlayerId === p.id,
    done = p.dungeonsCompleted || [];
  let html = roomChoiceMarkup(p);
  if (p.dungeon) {
    const d = DUNGEONS[p.dungeon.id],
      cur = d.rooms[p.dungeon.room];
    html += `<div class="dg-head"><span class="dg-name">${esc(d.name)}</span><span class="card-tool-note" style="margin:0">You're in <b>${esc(cur.n)}</b></span></div>`;
    if (!p.pendingRoom)
      html += `<p class="card-tool-label" style="margin-top:2px">Venture to the next room</p><div class="dg-choices">${cur.next
        .map(r => {
          const room = d.rooms[r];
          return `<button type="button" class="dg-choice" data-action="venture" data-player-id="${p.id}" data-room="${r}"><span class="dg-choice-name">${esc(room.n)}${room.next.length ? '' : ' · last room'}</span><span class="dg-choice-text">${esc(room.t)}</span></button>`;
        })
        .join('')}</div>`;
    html += `<p class="card-tool-label">Map</p><div class="dg-map" role="list" aria-label="${esc(d.name)} rooms">${dungeonLevels(
      d
    )
      .map(
        row =>
          `<div class="dg-row">${row
            .map(r => {
              const room = d.rooms[r],
                here = r === p.dungeon.room,
                canGo = cur.next.includes(r);
              return `<span role="listitem" class="dg-room${here ? ' here' : ''}${canGo ? ' next' : ''}" title="${esc(room.t)}">${esc(room.n)}${here ? ' (you are here)' : ''}</span>`;
            })
            .join('')}</div>`
      )
      .join('')}</div>`;
  } else {
    html += `<p class="card-tool-note" style="margin-top:0">Venture into the dungeon: choose one to enter.</p><div class="dg-choices">${[
      'lmop',
      'mad',
      'tomb'
    ]
      .map(id => {
        const d = DUNGEONS[id];
        return `<button type="button" class="dg-choice" data-action="venture" data-player-id="${p.id}" data-dungeon="${id}"><span class="dg-choice-name">${esc(d.name)}</span><span class="dg-choice-text">${Object.keys(d.rooms).length} rooms · starts at ${esc(d.rooms[d.start].n)}: ${esc(d.rooms[d.start].t)}</span></button>`;
      })
      .join('')}</div>`;
  }
  html += `<div class="dg-init"><p class="card-tool-label">Initiative</p>${hasInit ? `<p class="card-tool-note" style="margin:0 0 6px">${esc(p.name)} has the initiative. At the start of their upkeep, venture into Undercity.</p><button type="button" class="card-tool-primary" data-action="venture-undercity" data-player-id="${p.id}">${icon('dungeon')} Venture into Undercity</button><button type="button" class="card-tool-secondary" data-action="clear-initiative" data-player-id="${p.id}">${icon('x')} Clear initiative</button>` : `<p class="card-tool-note" style="margin:0 0 6px">${g?.initiativePlayerId ? esc(getPlayer(g.initiativePlayerId)?.name || 'Another player') + ' has the initiative.' : 'No one has the initiative.'} Taking it ventures into Undercity.</p><button type="button" class="card-tool-secondary" data-action="take-initiative" data-player-id="${p.id}">${icon('crown')} Take the initiative</button>`}</div>`;
  html += `<p class="card-tool-note">Dungeons completed: <b>${done.length}</b>${done.length ? ' · ' + done.map(esc).join(', ') : ''}</p>`;
  if (p.dungeon)
    html += `<button type="button" class="card-tool-secondary" data-action="leave-dungeon" data-player-id="${p.id}">${icon('x')} Remove from dungeon</button>`;
  return html;
}
function openMonarchPicker(playerId) {
  setCardPanel(playerId, 'monarch', { backTo: 'menu' });
}
function setMonarch(playerId, hostId = null) {
  const g = currentGame();
  if (!g) return;
  const nextId = playerId || null;
  if (nextId) {
    const next = getPlayer(nextId);
    if (!next || next.eliminated) {
      notify('An eliminated player cannot become the Monarch');
      return;
    }
  }
  const before = g.monarchPlayerId || null;
  if (before !== nextId) {
    g.monarchPlayerId = nextId;
    const next = nextId ? getPlayer(nextId) : null;
    const message = next ? `${next.name} became the Monarch` : 'The Monarch designation was cleared';
    const eventId = appendEvent(message, 'monarch', { before, playerId: nextId });
    pushFrame({ description: message, changes: [{ kind: 'monarch', before }], eventIds: [eventId] });
    saveStore();
    showToast(message);
  }
  if (hostId && getPlayer(hostId)) {
    cardPanels[hostId] = { type: 'monarch', backTo: 'menu' };
    renderGame();
  } else renderGame();
}
function handleMonarchLeaving(frame, eliminatedIds) {
  const g = currentGame();
  if (!g || !g.monarchPlayerId || !eliminatedIds.includes(g.monarchPlayerId)) return;
  const oldId = g.monarchPlayerId;
  const activeBefore = g.activePlayerId;
  let successor = null;
  const active = activeBefore ? g.players.find(p => p.id === activeBefore) : null;
  if (active && !active.eliminated && active.id !== oldId) successor = active;
  if (!successor) {
    const order = g.turnOrder || [];
    const start = order.indexOf(oldId);
    for (let step = 1; step < order.length; step++) {
      const candidate = g.players.find(p => p.id === order[(start + step) % order.length]);
      if (candidate && !candidate.eliminated) {
        successor = candidate;
        break;
      }
    }
  }
  frame.changes.push({ kind: 'monarch', before: oldId });
  g.monarchPlayerId = successor?.id || null;
  frame.eventIds.push(
    appendEvent(
      successor
        ? `${successor.name} became the Monarch because ${g.players.find(p => p.id === oldId)?.name || 'the Monarch'} left the game`
        : 'No eligible player remains to be the Monarch',
      'monarch',
      { before: oldId, playerId: g.monarchPlayerId }
    )
  );
}

function returnCardPanel(pid) {
  const state = cardPanels[pid];
  if (!state) return;
  if (state.type === 'customize') {
    delete customizeDrafts[pid];
    delete avatarDrafts[pid];
  }
  const target = state.backTo || 'menu';
  cardPanels[pid] = { type: target };
  renderGame();
}
function syncCustomizationDraftFromForm(pid) {
  const root = cardPanelRoot(pid),
    form = root?.querySelector('form[data-form="customize"]');
  if (!form) return;
  const data = new FormData(form),
    p = getPlayer(pid);
  if (!p) return;
  const previous = customizeDrafts[pid] || {};
  customizeDrafts[pid] = {
    name: String(data.get('name') || '').slice(0, 32),
    theme: String(data.get('theme') || p.theme),
    color: String(data.get('color') || ACCENTS[p.theme] || ACCENTS.blue),
    avatar: String(data.get('avatar') ?? p.avatar ?? ''),
    background: String(data.get('background') || p.background),
    rotation: Number(data.get('rotation') ?? p.rotation ?? 0),
    partner: data.get('partner') === 'on',
    saveProfileName: String(
      root.querySelector('[data-save-profile-name]')?.value ?? previous.saveProfileName ?? ''
    ).slice(0, 32),
    selectedProfileId: String(
      root.querySelector('[data-saved-profile-select]')?.value ?? previous.selectedProfileId ?? ''
    )
  };
}
function playerMenu(playerId) {
  setCardPanel(playerId, 'menu');
}
function customizePlayer(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  customizeDrafts[playerId] = {
    name: p.name,
    theme: p.theme,
    color: playerAccent(p),
    avatar: p.avatar || '',
    background: p.background,
    rotation: p.rotation || 0,
    partner: !!p.partner,
    saveProfileName: '',
    selectedProfileId: ''
  };
  avatarDrafts[playerId] = { avatar: p.avatar || '', dirty: false };
  setCardPanel(playerId, 'customize', { backTo: 'menu', selectedProfileId: '' });
}
function manageCounters(playerId) {
  setCardPanel(playerId, 'counters', { backTo: 'menu' });
}
function openCounterModal(playerId, key, counterId = null) {
  if (key === 'commander') return openCommanderDamagePicker(playerId);
  setCardPanel(playerId, 'counter', { counterKey: key, counterId: counterId || null, backTo: 'menu' });
}
function openCommanderDamagePicker(targetId, backTo = 'menu') {
  setCardPanel(targetId, 'commander-picker', { backTo });
}
function openCommanderValue(targetId, sourceId) {
  setCardPanel(targetId, 'commander-value', { sourceId, backTo: 'commander-picker' });
}
function addCustomCounterModal(playerId) {
  setCardPanel(playerId, 'add-custom', { backTo: 'counters' });
}
function startDice(playerId) {
  if (!diceDrafts[playerId])
    diceDrafts[playerId] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false };
  setCardPanel(playerId, 'dice');
}
function randomInt(max) {
  const arr = new Uint32Array(1);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
    return (arr[0] % max) + 1;
  }
  return Math.floor(Math.random() * max) + 1;
}
function performRoll(playerId) {
  const p = getPlayer(playerId),
    draft = diceDrafts[playerId];
  if (!p || !draft || draft.rolling) return;
  let mode = draft.mode,
    sides = draft.sides,
    count = Math.min(20, Math.max(1, Math.floor(Number(draft.count) || 1)));
  if (mode === 'custom') {
    const root = cardPanelRoot(playerId);
    sides = Math.min(
      100000,
      Math.max(
        2,
        Math.floor(
          Number(root?.querySelector('[data-action="custom-die-side-input"]')?.value) || draft.sides || 2
        )
      )
    );
    draft.sides = sides;
  }
  draft.count = count;
  draft.rolling = true;
  renderGame();
  const results = Array.from({ length: count }, () =>
    mode === 'coin' ? (randomInt(2) === 1 ? 'Heads' : 'Tails') : randomInt(sides)
  );
  if (mode !== 'coin') results.sort((a, b) => b - a);
  /* dice read highest to lowest */ const total =
    mode === 'coin' ? undefined : results.reduce((sum, n) => sum + Number(n), 0);
  const labels =
    mode === 'coin'
      ? `${count} coin flip${count === 1 ? '' : 's'}: ${results.join(', ')}`
      : `${count}d${sides}: ${results.join(', ')}${count > 1 ? ` (total ${total})` : ''}`;
  const message = `${p.name} rolled ${labels}`;
  setTimeout(
    () => {
      draft.rolling = false;
      draft.last = { mode, sides, count, results, total };
      const g = currentGame();
      if (!g) return;
      /* Rolls are logged but not added to Undo, so Undo always reverses a real game change. */ appendEvent(
        message,
        'dice',
        { playerId: p.id, roll: { mode, sides, count, results, total } }
      );
      saveStore();
      renderGame();
      showToast(`${p.name}: ${labels}`);
    },
    mode === 'coin' ? 900 : 480
  );
}
function logEntriesMarkup(events) {
  return [...events]
    .reverse()
    .map(
      e =>
        `<div class="log-entry ${e.undone ? 'undone' : ''}"><div class="log-time">${new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><div><div class="log-text">${esc(e.message)}${e.undone ? ' · UNDONE' : ''}</div><div class="log-tag">${esc(e.type)}</div></div></div>`
    )
    .join('');
}
function openTableLog() {
  const g = currentGame();
  if (!g) return;
  openModal(
    'Game Log',
    `<p class="modal-note">${g.events.length} events · shared by all players</p><div class="log-list">${logEntriesMarkup(g.events)}</div>`,
    true
  );
}
function hubTimerButton(g) {
  if (!g.timerStarted)
    return `<button type="button" class="btn-primary hub-timer-btn" id="hub-timer-btn" data-action="open-start-timer">${icon('play')} Start Timer</button>`;
  return `<button type="button" class="btn-secondary hub-timer-btn" id="hub-timer-btn" data-action="toggle-pause" data-state="${g.paused ? 'Resume' : 'Pause'}">${icon(g.paused ? 'play' : 'pause')} ${g.paused ? 'Resume' : 'Pause'}</button>`;
}
function openTableMenu() {
  const g = currentGame();
  if (!g) return;
  const running = !!(g.timerStarted && g.startedAt);
  openModal(
    'Table',
    `<div class="tm"><div class="hub-clock-row"><div><div class="field-label" style="margin:0 0 2px">Game time${g.paused ? ' · paused' : ''}</div><div class="hub-clock" id="hub-clock">${formatDuration(running ? clockNow(g) - g.startedAt : 0)}</div>${g.timerStarted ? '' : '<div class="modal-note" style="margin:2px 0 0">Timers haven\'t started yet.</div>'}</div>${hubTimerButton(g)}</div><div class="table-menu-grid">
<button type="button" class="table-tile" data-action="table-log">${icon('history')}<span>Game Log</span></button>
<button type="button" class="table-tile" data-action="table-layout">${icon('users')}<span>Table Layout</span></button>
<button type="button" class="table-tile" data-action="help">${icon('book')}<span>Help</span></button>
<button type="button" class="table-tile" data-action="return-menu">${icon('home')}<span>Main Menu</span></button>
</div><div class="table-menu-direction"><span class="field-label" style="margin:0">Turn direction</span><div class="segmented">${directionOptionsMarkup(g.turnDirection, 'set-direction')}</div></div><div class="table-menu-end"><button type="button" class="btn-secondary btn-block" data-action="end-game">${icon('trophy')} End Game</button><p class="modal-note">Leaving keeps the game saved; resume it from the main menu.</p></div></div>`,
    true
  );
}
function openExactLife(playerId) {
  if (!getPlayer(playerId)) return;
  flushPendingLife();
  setCardPanel(playerId, 'exact-life', { entry: '' });
}
function pressKeypad(playerId, key) {
  const state = cardPanels[playerId];
  if (!state || state.type !== 'exact-life') return;
  let entry = String(state.entry || '');
  if (key === 'set') {
    const value = Number(entry);
    if (!/^-?\d+$/.test(entry) || !Number.isInteger(value)) return;
    delete cardPanels[playerId];
    setExactLife(playerId, value);
    renderGame();
    return;
  }
  if (key === '⌫') entry = entry.slice(0, -1);
  else if (key === '±') entry = entry.startsWith('-') ? entry.slice(1) : `-${entry}`;
  else if (/^\d$/.test(key) && entry.replace('-', '').length < 4)
    entry = (entry === '0' ? '' : entry === '-0' ? '-' : entry) + key;
  state.entry = entry;
  renderGame();
}
function endGamePrompt() {
  const g = currentGame();
  if (!g) return;
  const choiceStyle =
    'width:100%;text-align:left;color:var(--text);background:transparent;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:14px 4px;cursor:pointer;display:flex;align-items:center;gap:12px';
  const options = g.players
    .map(
      p =>
        `<button type="button" class="modal-row result-choice" style="${choiceStyle}" data-action="set-result" data-result="${p.id}" aria-label="Declare ${esc(p.name)} the winner"><div class="modal-row-copy"><div class="modal-row-title">${esc(p.name)}${p.eliminated ? ' · Eliminated' : ''}</div><div class="modal-row-sub">Tap to declare winner · Final life: ${p.life}</div></div>${icon('chevron')}</button>`
    )
    .join('');
  openModal(
    'End Game',
    `<p class="modal-note">Choose a result below. Selecting a winner or Draw / No Winner will immediately save the result and open the game-over screen.</p><button type="button" class="modal-row result-choice" style="${choiceStyle}" data-action="set-result" data-result="draw" aria-label="End as a draw"><div class="modal-row-copy"><div class="modal-row-title">Draw / No Winner</div><div class="modal-row-sub">Finish the game without a declared winner.</div></div>${icon('chevron')}</button>${options}<div class="dialog-footer"><button type="button" class="btn-secondary" data-action="close-modal">Cancel</button></div>`
  );
}
function finalizeGame(result) {
  const g = currentGame();
  if (!g) {
    notify('There is no active game to finish');
    return;
  }
  flushPendingLife();
  let resultObj;
  if (result === 'draw') resultObj = { type: 'draw', label: 'Draw / No Winner' };
  else {
    const winner = g.players.find(p => p.id === result);
    if (!winner) {
      notify('Please choose a valid winner or draw');
      return;
    }
    resultObj = { type: 'winner', playerId: winner.id, label: winner.name };
  }
  appendEvent(
    resultObj.type === 'draw' ? 'Game ended · Draw / No Winner' : `Game ended · Winner: ${resultObj.label}`,
    'result'
  );
  const endedAt = Date.now();
  const totalDurationMs = g.timerStarted && g.startedAt ? Math.max(0, clockNow(g) - g.startedAt) : 0;
  const archive = {
    id: g.id,
    createdAt: g.createdAt || g.startedAt || endedAt,
    startedAt: g.startedAt || null,
    endedAt,
    totalDurationMs,
    timerStarted: !!g.timerStarted,
    playerCount: g.playerCount,
    startingLife: g.startingLife,
    seatOrder: (g.seatOrder || g.players.map(p => p.id)).slice(),
    monarchPlayerId: g.monarchPlayerId || null,
    players: g.players.map(p => ({
      id: p.id,
      slot: p.slot,
      name: p.name,
      life: p.life,
      eliminated: p.eliminated,
      eliminationReason: p.eliminationReason,
      commanderTax: Number(p.commanderTax) || 0,
      commanderTax2: Number(p.commanderTax2) || 0,
      partner: !!p.partner,
      counters: { ...p.counters, custom: p.counters.custom.map(c => ({ ...c })) },
      commanderDamage: { ...p.commanderDamage }
    })),
    events: g.events.map(e => ({ ...e })),
    result: resultObj
  };
  store.history = [archive, ...(store.history || [])].slice(0, 15);
  store.lastResult = archive;
  syncProfiles(g.players);
  store.currentGame = null;
  saveStore();
  closeModal();
  showScreen('gameover');
  showToast(
    resultObj.type === 'draw' ? 'Game saved · Draw / No Winner' : `Game saved · Winner: ${resultObj.label}`
  );
}
function renderGameover() {
  const r = store.lastResult;
  if (!r) return;
  $('#gameover-title').innerHTML = `Game Over<span class="second-line">The result has been saved.</span>`;
  $('#gameover-result-label').textContent = r.result.type === 'draw' ? 'RESULT' : 'WINNER';
  $('#gameover-result').textContent = r.result.label;
  $('#gameover-meta').textContent =
    `${r.playerCount} players · Total game time ${formatDuration(Number.isFinite(Number(r.totalDurationMs)) ? r.totalDurationMs : r.startedAt ? Math.max(0, r.endedAt - r.startedAt) : 0)} · ${new Date(r.endedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · Saved locally`;
  $('[data-action="view-last-log"]').disabled = !r.events.length;
}
function renderSettings() {
  const holder = $('#global-accent-options');
  holder.innerHTML = Object.entries(ACCENTS)
    .map(
      ([k, c]) =>
        `<button class="swatch ${store.prefs.accent === k ? 'selected' : ''}" data-action="global-accent" data-accent="${k}" title="${ACCENT_NAMES[k]} accent" aria-label="${ACCENT_NAMES[k]} accent" style="background:${c}"></button>`
    )
    .join('');
  const awake = $('#keep-awake-options');
  if (awake) {
    const on = keepAwakeEnabled();
    awake.innerHTML = [
      [true, 'On'],
      [false, 'Off']
    ]
      .map(
        ([v, l]) =>
          `<button type="button" class="segment ${on === v ? 'selected' : ''}" data-action="set-keep-awake" data-on="${v}" aria-pressed="${on === v}" style="padding:9px 14px;font-size:13px">${l}</button>`
      )
      .join('');
    const note = $('#keep-awake-note');
    if (note)
      note.textContent = wakeLockSupported()
        ? 'Works while a game is on screen. Turn off to let the device dim normally.'
        : 'This browser can’t keep the screen awake. On iPhone and iPad, update iOS, or set Auto-Lock to Never in Settings › Display & Brightness during games.';
  }
}
function renderHistory() {
  const list = $('#history-list');
  $('#history-subtitle').textContent = `${store.history.length} of 15 completed games saved on this device.`;
  if (!store.history.length) {
    list.innerHTML = `<div class="panel empty-state"><div class="empty-icon">${icon('history')}</div><strong>No completed games yet</strong><p>When you finish a game, its result and full event log will appear here.</p><button class="btn-secondary" data-action="go-setup">Start a Game</button></div>`;
    return;
  }
  list.innerHTML = store.history
    .map(g => {
      const date = new Date(g.endedAt);
      const players = g.players.map(p => p.name).join(', ');
      return `<button class="history-item" data-action="open-history-detail" data-game-id="${g.id}"><div class="history-date"><div class="day">${date.getDate()}</div><div class="month">${date.toLocaleString([], { month: 'short' }).toUpperCase()}</div></div><div class="history-copy"><div class="history-result">${esc(g.result.label)}</div><div class="history-players">${esc(players)}</div><div class="history-players">${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${g.playerCount} players · ${g.events.length} events</div></div>${icon('chevron', 'history-chevron')}</button>`;
    })
    .join('');
}
function openHistoryDetail(gameId) {
  const g = store.history.find(x => x.id === gameId);
  if (!g) return;
  const events = [...g.events]
    .reverse()
    .map(
      e =>
        `<div class="log-entry ${e.undone ? 'undone' : ''}"><div class="log-time">${new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><div><div class="log-text">${esc(e.message)}${e.undone ? ' · UNDONE' : ''}</div><div class="log-tag">${esc(e.type)}</div></div></div>`
    )
    .join('');
  openModal(
    g.result.label,
    `<p class="modal-note">${new Date(g.startedAt || g.createdAt || g.endedAt).toLocaleString()} · ${g.playerCount} players · Starting life ${g.startingLife} · Total timer ${formatDuration(Number.isFinite(Number(g.totalDurationMs)) ? g.totalDurationMs : g.startedAt ? Math.max(0, g.endedAt - g.startedAt) : 0)}</p><div class="panel" style="padding:13px;margin-bottom:13px"><div class="modal-row-title">Players</div><p class="small muted" style="margin:6px 0 0">${esc(g.players.map(p => p.name).join(', '))}</p></div><div class="log-list">${events}</div>`,
    true
  );
}
function showLastLog() {
  const r = store.lastResult;
  if (!r) return;
  const entries = [...r.events]
    .reverse()
    .map(
      e =>
        `<div class="log-entry ${e.undone ? 'undone' : ''}"><div class="log-time">${new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><div><div class="log-text">${esc(e.message)}${e.undone ? ' · UNDONE' : ''}</div><div class="log-tag">${esc(e.type)}</div></div></div>`
    )
    .join('');
  openModal(
    'Final Game Log',
    `<p class="modal-note">${esc(r.result.label)} · ${r.playerCount} players</p><div class="log-list">${entries}</div>`,
    true
  );
}
function chooseAccent(accent) {
  store.prefs.accent = accent;
  applyAccent();
  saveStore();
  renderSettings();
}
function confirmMainMenu() {
  openModal(
    'Return to Main Menu?',
    `<p class="modal-note">Your current game will remain saved in this browser, and you can resume it when you return. The active log will continue recording as long as the game stays open.</p><div class="dialog-footer"><button class="btn-secondary" data-action="close-modal">Stay at Table</button><button class="btn-primary" data-action="return-menu">Main Menu</button></div>`
  );
}
function updateProfileForm(playerId, theme) {
  const root = cardPanelRoot(playerId);
  if (!root) return;
  const swatches = root.querySelectorAll('.card-tool-swatches .swatch');
  swatches.forEach(b => b.classList.toggle('selected', b.dataset.theme === theme));
  const hidden = root.querySelector('[data-selected-player-theme]');
  if (hidden) hidden.value = theme;
  const color = root.querySelector('[data-player-color]');
  if (color && ACCENTS[theme]) color.value = ACCENTS[theme];
  if (customizeDrafts[playerId]) {
    customizeDrafts[playerId].theme = theme;
    if (color) customizeDrafts[playerId].color = color.value;
  }
}
function readCustomizationDraft(playerId) {
  const root = cardPanelRoot(playerId);
  const form = root?.querySelector('form[data-form="customize"]');
  const player = getPlayer(playerId);
  if (!form || !player) return customizeDrafts[playerId] || null;
  const data = new FormData(form),
    previous = customizeDrafts[playerId] || {};
  const draft = {
    name:
      String(data.get('name') || player.name)
        .trim()
        .slice(0, 32) || player.name,
    theme: String(data.get('theme') || player.theme),
    color: String(data.get('color') || ACCENTS[player.theme] || ACCENTS.blue),
    avatar: String(data.get('avatar') ?? player.avatar ?? ''),
    background: String(data.get('background') || player.background),
    rotation: Number(data.get('rotation') ?? player.rotation ?? 0),
    partner: data.get('partner') === 'on',
    saveProfileName: String(
      root.querySelector('[data-save-profile-name]')?.value ?? previous.saveProfileName ?? ''
    ).slice(0, 32),
    selectedProfileId: String(
      root.querySelector('[data-saved-profile-select]')?.value ?? previous.selectedProfileId ?? ''
    )
  };
  customizeDrafts[playerId] = draft;
  return draft;
}
function renderProfileSelect(playerId, selected = '') {
  const root = cardPanelRoot(playerId);
  const select = root?.querySelector('[data-saved-profile-select]');
  if (!select) return;
  select.innerHTML = `<option value="">Choose profile</option>${(store.savedProfiles || []).map(sp => `<option value="${sp.id}" ${sp.id === selected ? 'selected' : ''}>${esc(sp.name)}</option>`).join('')}`;
}
function saveCurrentProfile(playerId) {
  const draft = readCustomizationDraft(playerId);
  if (!draft) return;
  const name =
    String(draft.saveProfileName || '')
      .trim()
      .slice(0, 32) ||
    draft.name ||
    `Player ${getPlayer(playerId)?.slot || 1}`;
  const namedProfile = {
    name,
    theme: draft.theme,
    color: draft.color,
    avatar: draft.avatar,
    background: draft.background,
    partner: !!draft.partner
  };
  store.savedProfiles = Array.isArray(store.savedProfiles) ? store.savedProfiles : [];
  const existing = store.savedProfiles.find(sp => sp.name.toLowerCase() === name.toLowerCase());
  let selectedId;
  if (existing) {
    existing.profile = namedProfile;
    existing.updatedAt = Date.now();
    selectedId = existing.id;
  } else {
    const saved = { id: uid(), name, profile: namedProfile, createdAt: Date.now() };
    store.savedProfiles.unshift(saved);
    selectedId = saved.id;
  }
  if (cardPanels[playerId]) cardPanels[playerId].selectedProfileId = selectedId;
  customizeDrafts[playerId] = { ...draft, selectedProfileId: selectedId, saveProfileName: name };
  renderProfileSelect(playerId, selectedId);
  saveStore();
  const status = cardPanelRoot(playerId)?.querySelector('[data-profile-status]');
  if (status) status.textContent = `Saved “${name}”. Load it onto another card any time.`;
  showToast(`Profile “${name}” saved`);
}
function loadSelectedProfile(playerId) {
  const root = cardPanelRoot(playerId);
  const id = root?.querySelector('[data-saved-profile-select]')?.value;
  const saved = (store.savedProfiles || []).find(sp => sp.id === id);
  if (!saved) {
    notify('Choose a saved profile first');
    return;
  }
  const player = getPlayer(playerId);
  if (!player) return;
  const profile = saved.profile || {};
  player.name =
    String(saved.name || profile.name || player.name)
      .trim()
      .slice(0, 32) || `Player ${player.slot}`;
  player.background = String(profile.background || 'slate');
  player.theme = String(profile.theme || 'blue');
  player.color = /^#[0-9a-f]{6}$/i.test(profile.color || '')
    ? profile.color
    : ACCENTS[player.theme] || ACCENTS.blue;
  player.avatar = String(profile.avatar || '');
  player.partner = !!profile.partner;
  /* Rotation belongs to the seat, so a loaded profile keeps this card's current rotation. */ customizeDrafts[
    playerId
  ] = {
    name: player.name,
    background: player.background,
    theme: player.theme,
    color: player.color || ACCENTS[player.theme],
    avatar: player.avatar,
    rotation: player.rotation || 0,
    partner: player.partner,
    selectedProfileId: id,
    saveProfileName: saved.name
  };
  avatarDrafts[playerId] = { avatar: player.avatar, dirty: false };
  syncProfiles(currentGame().players);
  saveStore();
  if (cardPanels[playerId]) cardPanels[playerId].selectedProfileId = id;
  renderGame();
  showToast(`Applied profile “${saved.name}” to ${player.name}`);
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const max = 320,
          scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// Each finger is tracked separately so several players can tap or hold at once.
function clearPress(press) {
  clearTimeout(press.timer);
  clearInterval(press.interval);
  activePresses.delete(press.pointerId);
}
function clearAllPresses() {
  [...activePresses.values()].forEach(clearPress);
}
function handleLifePointerDown(e) {
  const zone = e.target.closest('[data-life-zone]');
  if (!zone || e.button !== 0) return;
  const playerId = zone.dataset.playerId,
    which = zone.dataset.lifeZone;
  const old = activePresses.get(e.pointerId);
  if (old) clearPress(old);
  const press = { playerId, which, didHold: false, pointerId: e.pointerId, timer: null, interval: null };
  activePresses.set(e.pointerId, press);
  if (which === 'center') {
    press.timer = setTimeout(() => {
      if (activePresses.get(press.pointerId) !== press) return;
      press.didHold = true;
      clearPress(press);
      flushPendingLife();
      try {
        navigator.vibrate?.(20);
      } catch (_) {}
      openCommanderDamagePicker(playerId, 'menu');
    }, 550);
    return;
  }
  e.preventDefault();
  press.timer = setTimeout(() => {
    if (activePresses.get(press.pointerId) !== press) return;
    press.didHold = true;
    const delta = which === 'left' ? -10 : 10;
    bumpLife(playerId, delta);
    press.interval = setInterval(() => bumpLife(playerId, delta), 330);
  }, 380);
}
function handleLifePointerUp(e) {
  const press = activePresses.get(e.pointerId);
  if (!press) return;
  clearPress(press);
  if (press.didHold) return;
  if (press.which === 'center') {
    flushPendingLife();
    openExactLife(press.playerId);
    return;
  }
  bumpLife(press.playerId, press.which === 'left' ? -1 : 1);
}
function handleLifePointerCancel(e) {
  const press = activePresses.get(e.pointerId);
  if (press) clearPress(press);
}

// One delegated interaction handler keeps dynamically rendered modal content functional.
document.addEventListener('click', e => {
  // Keyboard activation of a life zone (Enter/Space) arrives as a click with detail 0; pointer taps are handled on pointerup.
  const zone = e.target.closest('[data-life-zone]');
  if (zone) {
    if (e.detail === 0) {
      const which = zone.dataset.lifeZone,
        zid = zone.dataset.playerId;
      if (which === 'center') {
        flushPendingLife();
        openExactLife(zid);
      } else bumpLife(zid, which === 'left' ? -1 : 1);
    }
    return;
  }
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  const pid = b.dataset.playerId;
  if (a !== 'undo' && currentGame() && flushPendingLife()) renderGame();
  switch (a) {
    case 'go-setup':
      setupDraft = { ...(store.lastSetup || { playerCount: 4, startingLife: 40 }) };
      showScreen('setup');
      break;
    case 'quick-start':
      setupDraft = { ...(store.lastSetup || { playerCount: 4, startingLife: 40, firstPlayer: 1 }) };
      startGame(true);
      break;
    case 'resume-current-game':
      closeModal();
      showScreen('game');
      break;
    case 'confirm-new-game':
      closeModal();
      startGame(b.dataset.quick === 'true', true);
      break;
    case 'main-menu':
      closeModal();
      showScreen('menu');
      break;
    case 'confirm-main-menu':
      confirmMainMenu();
      break;
    case 'return-menu':
      closeModal();
      showScreen('menu');
      break;
    case 'choose-count':
      setupDraft.playerCount = Number(b.dataset.count);
      if (Number(setupDraft.firstPlayer) > setupDraft.playerCount) setupDraft.firstPlayer = 1;
      renderSetup();
      break;
    case 'load-last-setup':
      setupDraft = { ...(store.lastSetup || { playerCount: 4, startingLife: 40 }) };
      renderSetup();
      showToast('Last setup loaded. Press Start Game when ready.');
      break;
    case 'setup-life-preset': {
      setupDraft.startingLife = Number(b.dataset.life);
      const input = $('#starting-life-input');
      if (input) input.value = setupDraft.startingLife;
      renderSetup();
      break;
    }
    case 'setup-life-step': {
      const input = $('#starting-life-input');
      const n = Number(input.value || 0) + Number(b.dataset.delta);
      setupDraft.startingLife = n;
      input.value = n;
      break;
    }
    case 'start-game': {
      const input = $('#starting-life-input');
      if (input && input.value.trim() === '') {
        notify('Enter a starting life total');
        break;
      }
      if (input) setupDraft.startingLife = Number(input.value);
      if (!Number.isInteger(Number(setupDraft.startingLife)) || Number(setupDraft.startingLife) < 1) {
        notify('Enter a whole-number starting life total of 1 or more');
        break;
      }
      applySetupPlayers(Math.min(6, Math.max(2, Number(setupDraft.playerCount) || 4)));
      startGame(false);
      break;
    }
    case 'settings':
      closeModal();
      showScreen('settings');
      break;
    case 'help':
      closeModal();
      showScreen('help');
      break;
    case 'history':
      showScreen('history');
      break;
    case 'global-accent':
      chooseAccent(b.dataset.accent);
      showToast(`${ACCENT_NAMES[b.dataset.accent]} accent selected`);
      break;
    case 'undo':
      undoLast();
      break;
    case 'open-start-timer':
      openStartTimerModal();
      break;
    case 'choose-game-starter':
      pendingFirstPlayerSlot = Number(b.dataset.slot) || 1;
      openStartTimerModal(true);
      break;
    case 'start-timers':
      startGameTimers();
      break;
    case 'pass-turn':
      passTurn(pid);
      break;
    case 'dice':
      startDice(pid);
      break;
    case 'card-lookup':
      openCardLookup(b);
      break;
    case 'dungeon-panel':
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'venture':
      venture(pid, { dungeonId: b.dataset.dungeon || null, roomId: b.dataset.room || null });
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'take-initiative':
      takeInitiative(pid);
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'venture-undercity':
      ventureUndercity(pid);
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'clear-initiative':
      clearInitiative();
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'leave-dungeon':
      leaveDungeon(pid);
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'room-target':
      resolveRoomChoice(pid, { targetId: b.dataset.targetId });
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'room-apply': {
      const root = cardPanelRoot(pid) || document;
      resolveRoomChoice(pid, {
        payers: [...root.querySelectorAll('[data-room-payer]:checked')].map(x => x.dataset.roomPayer)
      });
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    }
    case 'room-skip':
      resolveRoomChoice(pid, { skip: true });
      setCardPanel(pid, 'dungeon', { backTo: 'menu' });
      break;
    case 'table-menu':
      openTableMenu();
      break;
    case 'set-keep-awake':
      setKeepAwake(b.dataset.on === 'true');
      break;
    case 'set-direction':
      setTurnDirection(b.dataset.dir);
      openTableMenu();
      break;
    case 'choose-start-direction':
      setTurnDirection(b.dataset.dir);
      openStartTimerModal(true);
      break;
    case 'toggle-theme':
      setTheme(currentTheme() === 'light' ? 'dark' : 'light');
      break;
    case 'set-theme':
      setTheme(b.dataset.mode);
      break;
    case 'table-layout':
      openLayoutPicker();
      break;
    case 'set-game-layout':
      setGameLayout(b.dataset.layout);
      break;
    case 'choose-layout': {
      const count = Number(setupDraft.playerCount) || 4;
      setupDraft.layouts = { ...(setupDraft.layouts || {}), [count]: b.dataset.layout };
      renderSetup();
      break;
    }
    case 'table-log':
      openTableLog();
      break;
    case 'exact-life':
      openExactLife(pid);
      break;
    case 'keypad':
      pressKeypad(pid, b.dataset.key);
      break;
    case 'player-menu':
      playerMenu(pid);
      break;
    case 'customize':
      customizePlayer(pid);
      break;
    case 'close-card-panel':
      closeCardPanel(pid);
      break;
    case 'back-card-panel':
      returnCardPanel(pid);
      break;
    case 'choose-player-theme':
      updateProfileForm(pid, b.dataset.theme);
      break;
    case 'save-profile':
      saveCurrentProfile(pid);
      break;
    case 'load-profile':
      loadSelectedProfile(pid);
      break;
    case 'remove-avatar': {
      const root = cardPanelRoot(pid),
        hidden = root?.querySelector('[data-avatar-data]'),
        preview = root?.querySelector('[data-avatar-preview]'),
        draft = customizeDrafts[pid] || {};
      draft.avatar = '';
      customizeDrafts[pid] = draft;
      avatarDrafts[pid] = { avatar: '', dirty: true };
      if (hidden) hidden.value = '';
      if (preview)
        preview.innerHTML = esc(
          (root?.querySelector('[name="name"]')?.value || getPlayer(pid)?.name || 'Player')
            .trim()
            .split(/\s+/)
            .map(x => x[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase()
        );
      showToast('Image will be removed when you save the card');
      break;
    }
    case 'manage-counters':
      manageCounters(pid);
      break;
    case 'counter-badge':
      openCounterModal(pid, b.dataset.counter, b.dataset.counterId || null);
      break;
    case 'counter-change':
      changeCounter(pid, b.dataset.counter, Number(b.dataset.delta), b.dataset.counterId || null);
      break;
    case 'commander-picker':
      openCommanderDamagePicker(pid, 'menu');
      break;
    case 'commander-select':
      openCommanderValue(pid, b.dataset.sourceId);
      break;
    case 'commander-change':
      changeCommanderDamage(pid, b.dataset.sourceId, Number(b.dataset.delta));
      break;
    case 'commander-tax':
      openCommanderTax(pid);
      break;
    case 'commander-tax-change':
      changeCommanderTax(pid, Number(b.dataset.delta), b.dataset.field);
      break;
    case 'toggle-pause':
      togglePause();
      break;
    case 'confirm-eliminate':
      setCardPanel(pid, 'confirm-eliminate', { backTo: 'menu' });
      break;
    case 'revive-player':
      revivePlayer(pid);
      if (cardPanels[pid]) cardPanels[pid] = { type: 'menu' };
      renderGame();
      break;
    case 'ask-delete-custom-counter':
      if (cardPanels[pid]) cardPanels[pid].confirmDelete = true;
      renderGame();
      break;
    case 'delete-custom-counter':
      deleteCustomCounter(pid, b.dataset.counterId);
      break;
    case 'monarch-picker':
      openMonarchPicker(pid);
      break;
    case 'set-monarch':
      setMonarch(pid || null, b.dataset.hostId || pid);
      break;
    case 'add-custom-counter':
      addCustomCounterModal(pid);
      break;
    case 'manual-eliminate': {
      manualElimination(pid);
      delete cardPanels[pid];
      renderGame();
      break;
    }
    case 'close-modal':
      closeModal();
      break;
    case 'dice-mode': {
      const draft =
        diceDrafts[pid] ||
        (diceDrafts[pid] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false });
      draft.mode = b.dataset.mode;
      if (draft.mode === 'die') draft.sides = [4, 6, 8, 10, 12, 20].includes(draft.sides) ? draft.sides : 20;
      renderGame();
      break;
    }
    case 'dice-sides': {
      const draft =
        diceDrafts[pid] ||
        (diceDrafts[pid] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false });
      draft.sides = Number(b.dataset.sides);
      draft.mode = 'die';
      renderGame();
      break;
    }
    case 'dice-count-step': {
      const draft =
        diceDrafts[pid] ||
        (diceDrafts[pid] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false });
      draft.count = Math.min(20, Math.max(1, (Number(draft.count) || 1) + Number(b.dataset.delta)));
      renderGame();
      break;
    }
    case 'roll-dice':
      performRoll(pid);
      break;
    case 'end-game':
      endGamePrompt();
      break;
    case 'view-last-log':
      showLastLog();
      break;
    case 'open-history-detail':
      openHistoryDetail(b.dataset.gameId);
      break;
    case 'set-result':
      finalizeGame(b.dataset.result);
      break;
  }
});
document.addEventListener('pointerdown', handleSeatDragStart);
document.addEventListener('pointermove', handleSeatDragMove);
document.addEventListener('pointerup', finishSeatDrag);
document.addEventListener('pointercancel', cancelSeatDrag);
document.addEventListener('pointerdown', handleLifePointerDown);
document.addEventListener('pointerup', handleLifePointerUp);
document.addEventListener('pointercancel', handleLifePointerCancel);
document.addEventListener('input', e => {
  if (e.target.matches?.('[data-setup-name]')) {
    setupDraft.names = { ...(setupDraft.names || {}), [e.target.dataset.setupName]: e.target.value };
    return;
  }
  if (e.target.id === 'starting-life-input') {
    const v = Number(e.target.value);
    $$('#life-presets .life-preset').forEach(x => {
      const on = Number(x.dataset.life) === v;
      x.classList.toggle('selected', on);
      x.setAttribute('aria-pressed', on);
    });
  }
  if (e.target.id === 'starting-life-input') setupDraft.startingLife = e.target.value;
  const panel = e.target.closest('[data-card-panel-owner]');
  const pid = panel?.dataset.cardPanelOwner;
  if (pid && cardPanels[pid] && e.target.matches('[name="counterName"]')) {
    if (panel.dataset.cardPanelType === 'add-custom') cardPanels[pid].draftName = e.target.value;
    else cardPanels[pid].renameDraft = e.target.value;
  }
  if (pid && panel.dataset.cardPanelType === 'customize') {
    if (
      e.target.matches(
        '[name="name"],[name="background"],[name="rotation"],[name="theme"],[name="color"],[data-avatar-data],[data-save-profile-name]'
      )
    )
      syncCustomizationDraftFromForm(pid);
    if (e.target.matches('[data-player-color]')) {
      panel.querySelectorAll('.card-tool-swatches .swatch').forEach(b => b.classList.remove('selected'));
      if (customizeDrafts[pid]) customizeDrafts[pid].color = e.target.value;
    }
  }
  if (pid && e.target.matches('[data-action="custom-die-side-input"]')) {
    const draft =
      diceDrafts[pid] || (diceDrafts[pid] = { mode: 'die', sides: 20, count: 1, last: null, rolling: false });
    draft.sides = Math.min(100000, Math.max(2, Math.floor(Number(e.target.value) || 2)));
  }
});
document.addEventListener('change', async e => {
  if (e.target.matches('[data-avatar-file]')) {
    const file = e.target.files?.[0];
    if (!file) return;
    const panel = e.target.closest('[data-card-panel-owner]');
    const pid = panel?.dataset.cardPanelOwner;
    if (!pid) return;
    try {
      const dataUrl = await resizeImage(file);
      avatarDrafts[pid] = { avatar: dataUrl, dirty: true };
      if (customizeDrafts[pid]) customizeDrafts[pid].avatar = dataUrl;
      const root = cardPanelRoot(pid),
        hidden = root?.querySelector('[data-avatar-data]'),
        preview = root?.querySelector('[data-avatar-preview]');
      if (hidden) hidden.value = dataUrl;
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Avatar preview">`;
      syncCustomizationDraftFromForm(pid);
      if (customizeDrafts[pid]) customizeDrafts[pid].avatar = dataUrl;
    } catch (err) {
      notify(err.message || 'Could not load image');
    }
  } else if (e.target.closest('form[data-form="customize"]')) {
    const pid = e.target.closest('form').dataset.playerId;
    syncCustomizationDraftFromForm(pid);
  }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = new FormData(form),
    kind = form.dataset.form,
    pid = form.dataset.playerId;
  if (kind === 'customize') {
    const p = getPlayer(pid);
    if (!p) return;
    p.name =
      String(data.get('name') || `Player ${p.slot}`)
        .trim()
        .slice(0, 32) || `Player ${p.slot}`;
    p.background = String(data.get('background') || 'slate');
    p.theme = String(data.get('theme') || p.theme);
    p.color = String(data.get('color') || ACCENTS[p.theme] || ACCENTS.blue);
    p.avatar = String(data.get('avatar') || '');
    p.partner = data.get('partner') === 'on';
    syncProfiles(currentGame().players);
    saveStore();
    delete cardPanels[pid];
    delete customizeDrafts[pid];
    delete avatarDrafts[pid];
    renderGame();
    showToast(`${p.name}'s card updated`);
  } else if (kind === 'add-custom') {
    const p = getPlayer(pid);
    const name = String(data.get('counterName') || '')
      .trim()
      .slice(0, 24);
    if (!p || !name) return;
    if (p.counters.custom.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      notify('That custom counter already exists');
      return;
    }
    p.counters.custom.push({ id: uid(), name, value: 0 });
    appendEvent(`${p.name} added a ${name} counter`, 'counter', { playerId: p.id });
    saveStore();
    manageCounters(pid);
  } else if (kind === 'rename-custom') {
    renameCustomCounter(pid, form.dataset.counterId, data.get('counterName'));
  }
});
$('#modal-backdrop').addEventListener('click', e => {
  if (e.target === $('#modal-backdrop')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#modal-backdrop').classList.contains('open')) closeModal();
});

// When the page closes, remember when; on reopen, a running game comes back paused at that moment so closed time isn't counted.
// Keep the screen from dimming or locking while a game is on screen (Screen Wake Lock; ignored where unsupported).
function keepAwakeEnabled() {
  return store.prefs?.keepAwake !== false;
}
function wakeLockSupported() {
  return 'wakeLock' in navigator;
}
async function updateWakeLock() {
  const want =
    keepAwakeEnabled() &&
    currentScreen === 'game' &&
    !!currentGame() &&
    document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && wakeLockSupported()) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!want && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch (e) {
    wakeLock = null;
  }
}
function setKeepAwake(on) {
  store.prefs = { ...(store.prefs || {}), keepAwake: !!on };
  saveStore();
  updateWakeLock();
  renderSettings();
}
document.addEventListener('visibilitychange', updateWakeLock);
// Some browsers only grant the lock after a tap, so retry on the next touch if it isn't held yet.
document.addEventListener(
  'pointerdown',
  () => {
    if (!wakeLock) updateWakeLock();
  },
  { passive: true }
);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline support unavailable', err))
  );
}
window.addEventListener('pagehide', () => {
  const g = currentGame();
  flushPendingLife();
  if (g && g.timerStarted && !g.paused) g.hiddenAt = Date.now();
  writeStore();
});
window.addEventListener('pageshow', e => {
  const g = currentGame();
  if (e.persisted && g) {
    g.hiddenAt = null;
    saveStore();
  }
});
(function resumeAfterClose() {
  const g = currentGame();
  if (!g) return;
  if (g.timerStarted && !g.paused && Number.isFinite(Number(g.hiddenAt))) {
    g.paused = true;
    g.pausedAt = Number(g.hiddenAt);
    appendEvent('Timers paused while the tracker was closed', 'system');
  }
  g.hiddenAt = null;
  saveStore();
})();
applyTheme();
applyAccent();
renderMenuMeta();
if (store.currentGame) {
  showScreen('game');
} else {
  showScreen('menu');
}
setInterval(updateGameClocks, 1000);
/* Card lookup: the scanner (scanner/) opens full screen over the current screen and closes back to it.
   The game is never left, so life totals, timers and turns are untouched. */
let lookupOpener = null,
  lookupPlayer = null,
  lastLookupLog = { name: '', at: 0 };
function lookupContext() {
  // Which player opened the lookup (from their menu), so the scanner can offer "Set as commander".
  const p = lookupPlayer && currentScreen === 'game' ? getPlayer(lookupPlayer) : null;
  return p
    ? {
        id: p.id,
        name: p.name,
        partner: !!p.partner,
        commander: p.commander || '',
        commander2: p.commander2 || ''
      }
    : null;
}
function openCardLookup(opener) {
  const layer = document.getElementById('lookup-layer');
  lookupOpener = opener || document.activeElement;
  lookupPlayer = opener?.dataset?.playerId || null;
  let frame = layer.querySelector('iframe');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.src = 'scanner/?embed=1';
    frame.title = 'Card lookup';
    frame.allow = 'camera';
    frame.addEventListener('load', () =>
      frame.contentWindow?.postMessage(
        { type: 'card-lookup-context', player: lookupContext() },
        location.origin
      )
    );
    layer.appendChild(frame);
  } else
    frame.contentWindow?.postMessage({ type: 'card-lookup-open', player: lookupContext() }, location.origin);
  layer.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => frame.focus(), 50);
}
function closeCardLookup() {
  const layer = document.getElementById('lookup-layer');
  if (layer.hidden) return;
  layer.querySelector('iframe')?.contentWindow?.postMessage({ type: 'card-lookup-hidden' }, location.origin);
  layer.hidden = true;
  document.body.style.overflow = '';
  if (lookupOpener && document.contains(lookupOpener)) lookupOpener.focus({ preventScroll: true });
  lookupOpener = null;
}
function setCommanderFromLookup(d) {
  const p = getPlayer(d.playerId);
  if (!p || !currentGame()) return;
  if (d.slot === 2) p.commander2 = d.name;
  else {
    p.commander = d.name;
    if (d.art) p.avatar = d.art;
  }
  appendEvent(`${p.name}'s ${d.slot === 2 ? 'partner commander' : 'commander'}: ${d.name}`, 'system');
  saveStore();
  closeCardLookup();
  if (cardPanels[p.id]) closeCardPanel(p.id);
  else renderGame();
}
function logLookup(d) {
  // Lookups during a game go in the game log; flipping between printings of one card counts once.
  if (currentScreen !== 'game' || !currentGame()) return;
  if (d.name === lastLookupLog.name && Date.now() - lastLookupLog.at < 120000) return;
  lastLookupLog = { name: d.name, at: Date.now() };
  const who = d.playerId && getPlayer(d.playerId) ? getPlayer(d.playerId).name : 'Card lookup';
  appendEvent(`${who} looked up ${d.name} · ${String(d.set || '').toUpperCase()} #${d.num}`, 'lookup');
  saveStore();
}
addEventListener('message', e => {
  if (e.origin !== location.origin) return;
  const t = e.data?.type;
  if (t === 'card-lookup-close') closeCardLookup();
  else if (t === 'set-commander') setCommanderFromLookup(e.data);
  else if (t === 'card-looked-up') logLookup(e.data);
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('lookup-layer').hidden) closeCardLookup();
});
// Setup: choosing a saved profile for a seat fills in its name.
document.addEventListener('change', e => {
  const sel = e.target.closest?.('[data-setup-profile]');
  if (!sel) return;
  const slot = sel.dataset.setupProfile;
  setupDraft.profiles = { ...(setupDraft.profiles || {}), [slot]: sel.value };
  const sp = (store.savedProfiles || []).find(x => x.id === sel.value);
  if (sp) {
    setupDraft.names = { ...(setupDraft.names || {}), [slot]: sp.name };
  }
  renderSetup();
  document.getElementById('setup-profile-' + slot)?.focus();
});
