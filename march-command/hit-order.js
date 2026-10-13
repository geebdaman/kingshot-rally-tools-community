// Hit order add-on: reorder who lands first without renaming players.
// Drag a player (or use the arrows) to change their place; drop them under
// another group heading to move them into that group.
(() => {
  const schedule = document.querySelector('.schedule');
  if (!schedule || typeof state === 'undefined') return;

  const panel = document.createElement('section');
  panel.className = 'panel hitorder';
  panel.innerHTML = `<div class="sectionhead"><div><h2>Hit order</h2><p class="muted">Drag players to change who lands first. Drop a player under another group to move them there.</p></div><span class="pill" id="ho-count"></span></div><div class="ho-head"><span></span><span>#</span><span>Player / group</span><span>Call rally</span><span>Hit</span><span>Move</span></div><ol id="ho-list"></ol><p class="hint">Changes update the launch schedule instantly. A running countdown stops — copy again to restart.</p><span id="ho-saver" hidden></span>`;
  schedule.parentNode.insertBefore(panel, schedule);
  const list = panel.querySelector('#ho-list');
  const saver = panel.querySelector('#ho-saver');

  const shownGroups = () => state.groups.filter(g => g.on);
  const effective = p => Math.max(0, Number(p.duration) - (p.pet ? 3 : 0));

  // Current order as a flat sequence: group heading, its players, next heading, ...
  function sequence() {
    const seq = [];
    for (const g of shownGroups()) {
      seq.push({ type: 'g', id: g.id });
      for (const p of state.players) if (p.on && p.group === g.id) seq.push({ type: 'p', id: p.id });
    }
    return seq;
  }

  // Write a sequence back into the plan: players take the group of the heading above them.
  function apply(seq) {
    let group = null;
    const ordered = [];
    for (const item of seq) {
      if (item.type === 'g') { group = item.id; continue; }
      const p = state.players.find(x => x.id === item.id);
      if (p && group !== null) { p.group = group; ordered.push(p); }
    }
    state.players = [...ordered, ...state.players.filter(p => !ordered.includes(p))];
    render();
    saver.dispatchEvent(new Event('change', { bubbles: true })); // lets save.js store the new order
  }

  function draw() {
    const hits = new Map((typeof result !== 'undefined' ? result : []).map(r => [r.id, r]));
    let pos = 0, count = 0, html = '';
    for (const item of sequence()) {
      if (item.type === 'g') {
        const g = state.groups.find(x => x.id === item.id);
        const pattern = g.mode === 'together' ? 'Same time' : `Spaced ${esc(g.spacing)}s`;
        html += `<li class="ho-group" data-group="${g.id}"><span class="eyebrow">${esc(g.name).toUpperCase()}</span><small>${pattern}</small></li>`;
        continue;
      }
      const p = state.players.find(x => x.id === item.id);
      const r = hits.get(p.id);
      count++;
      html += `<li class="ho-player" data-player="${p.id}"><span class="ho-handle" aria-hidden="true">⠿</span><span class="ho-pos">${++pos}</span><span class="ho-name"><strong>${esc(p.name)}</strong><small>${esc(state.groups.find(x => x.id === p.group).name)} · ${effective(p)}s${p.pet ? ' · pet on' : ''}</small></span><span class="ho-call">${r ? relative(r.rallyStart) : ''}</span><span class="ho-hit">${r ? relative(r.hit) : ''}</span><span class="ho-btns"><button type="button" data-ho="up" aria-label="Move ${esc(p.name)} earlier">↑</button><button type="button" data-ho="down" aria-label="Move ${esc(p.name)} later">↓</button></span></li>`;
    }
    list.innerHTML = count ? html : '<li class="ho-empty">Check players and enable a group to set the hit order.</li>';
    panel.querySelector('#ho-count').textContent = count + ' in order';
    const items = [...list.children];
    const first = items.find(li => li.dataset.player), last = [...items].reverse().find(li => li.dataset.player);
    if (first) first.querySelector('[data-ho="up"]').disabled = true;
    if (last && last.nextElementSibling === null) last.querySelector('[data-ho="down"]').disabled = true;
  }

  // Redraw whenever the main tool recalculates the schedule.
  const baseUpdate = update;
  update = function () { baseUpdate.apply(this, arguments); draw(); };

  // Arrow buttons: swap with the neighbour (crossing a heading moves to the next group).
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-ho]');
    if (!btn) return;
    const seq = sequence();
    const i = seq.findIndex(x => x.type === 'p' && x.id === Number(btn.closest('li').dataset.player));
    const j = btn.dataset.ho === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 1 || j >= seq.length) return;
    [seq[i], seq[j]] = [seq[j], seq[i]];
    apply(seq);
  });

  // Drag with mouse or touch using the ⠿ handle.
  let dragging = null;
  list.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.ho-handle');
    if (!handle) return;
    e.preventDefault();
    dragging = handle.closest('li');
    dragging.classList.add('ho-dragging');
    list.setPointerCapture(e.pointerId); // the list stays put while rows move
  });
  list.addEventListener('pointermove', e => {
    if (!dragging) return;
    const others = [...list.children].filter(li => li !== dragging);
    let before = others.find(li => { const b = li.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (before === others[0]) before = others[1] || null; // never above the first group heading
    if (dragging.nextElementSibling !== before) list.insertBefore(dragging, before || null);
  });
  const drop = () => {
    if (!dragging) return;
    dragging.classList.remove('ho-dragging');
    dragging = null;
    apply([...list.children].map(li => li.dataset.group ? { type: 'g', id: Number(li.dataset.group) } : { type: 'p', id: Number(li.dataset.player) }));
  };
  list.addEventListener('pointerup', drop);
  list.addEventListener('pointercancel', drop);

  draw();
})();
