/* Roster Management */
let allPlayers = [];
let currentFilter = 'active';
let deleteTargetId = null;

// --- Load & Render ---

async function loadPlayers() {
  const res = await fetch('/api/players?all=1');
  allPlayers = await res.json();
  renderTable();
}

function renderTable() {
  const tbody = document.querySelector('#rosterTable tbody');
  const empty = document.getElementById('rosterEmpty');

  let filtered = allPlayers;
  if (currentFilter === 'active') filtered = allPlayers.filter(p => p.is_active);
  else if (currentFilter === 'inactive') filtered = allPlayers.filter(p => !p.is_active);

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(p => `
    <tr class="${p.is_active ? '' : 'table-secondary'}">
      <td>${esc(p.last_name)}</td>
      <td>${esc(p.first_name)}</td>
      <td>${esc(p.class_year || '')}</td>
      <td>${p.is_pitcher ? '<span class="badge bg-info">P</span>' : ''}</td>
      <td>${p.is_active
        ? '<span class="badge bg-success">Active</span>'
        : '<span class="badge bg-secondary">Inactive</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditPlayer(${p.id})">Edit</button>
        <button class="btn btn-sm btn-outline-${p.is_active ? 'warning' : 'success'}" onclick="toggleActive(${p.id})">
          ${p.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button class="btn btn-sm btn-outline-danger ms-1" onclick="openDeletePlayer(${p.id})">Del</button>
      </td>
    </tr>
  `).join('');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Filter ---

document.querySelectorAll('#filterBtns .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('#filterBtns .active').classList.remove('active');
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTable();
  });
});

// --- Add / Edit ---

function openAddPlayer() {
  document.getElementById('playerModalTitle').textContent = 'Add Player';
  document.getElementById('editPlayerId').value = '';
  document.getElementById('playerFirst').value = '';
  document.getElementById('playerLast').value = '';
  document.getElementById('playerClass').value = '';
  document.getElementById('playerPitcher').checked = false;
  document.getElementById('playerFormError').textContent = '';
}

function openEditPlayer(id) {
  const p = allPlayers.find(pl => pl.id === id);
  if (!p) return;
  document.getElementById('playerModalTitle').textContent = 'Edit Player';
  document.getElementById('editPlayerId').value = p.id;
  document.getElementById('playerFirst').value = p.first_name;
  document.getElementById('playerLast').value = p.last_name;
  document.getElementById('playerClass').value = p.class_year || '';
  document.getElementById('playerPitcher').checked = !!p.is_pitcher;
  document.getElementById('playerFormError').textContent = '';
  new bootstrap.Modal(document.getElementById('playerModal')).show();
}

async function savePlayer() {
  const first = document.getElementById('playerFirst').value.trim();
  const last = document.getElementById('playerLast').value.trim();
  const cls = document.getElementById('playerClass').value;
  const pitcher = document.getElementById('playerPitcher').checked;
  const errEl = document.getElementById('playerFormError');

  if (!first || !last) { errEl.textContent = 'First and last name are required.'; return; }

  const editId = document.getElementById('editPlayerId').value;
  const body = { first_name: first, last_name: last, class_year: cls || null, is_pitcher: pitcher };

  let res;
  if (editId) {
    // Editing — preserve current active status
    const existing = allPlayers.find(p => p.id === parseInt(editId));
    body.is_active = existing ? !!existing.is_active : true;
    res = await fetch(`/api/players/${editId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
  } else {
    res = await fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
  }

  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error || 'Save failed.'; return; }

  bootstrap.Modal.getInstance(document.getElementById('playerModal')).hide();
  await loadPlayers();
}

// --- Toggle Active ---

async function toggleActive(id) {
  const p = allPlayers.find(pl => pl.id === id);
  if (!p) return;
  await fetch(`/api/players/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: p.first_name, last_name: p.last_name,
      class_year: p.class_year, is_pitcher: !!p.is_pitcher,
      is_active: !p.is_active
    })
  });
  await loadPlayers();
}

// --- Delete ---

function openDeletePlayer(id) {
  const p = allPlayers.find(pl => pl.id === id);
  if (!p) return;
  deleteTargetId = id;
  document.getElementById('deletePlayerName').textContent = `${p.first_name} ${p.last_name}`;
  document.getElementById('deleteError').textContent = '';
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const res = await fetch(`/api/players/${deleteTargetId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('deleteError').textContent = data.error || 'Delete failed.';
    return;
  }
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  deleteTargetId = null;
  await loadPlayers();
}

// --- Init ---
loadPlayers();
