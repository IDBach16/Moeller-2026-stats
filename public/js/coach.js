(function() {
  'use strict';

  const BATTING_COLS = [
    { key: 'last_name', label: 'Last', type: 'text' },
    { key: 'first_name', label: 'First', type: 'text' },
    { key: 'gp', label: 'GP', type: 'int' },
    { key: 'pa', label: 'PA', type: 'int' },
    { key: 'ab', label: 'AB', type: 'int' },
    { key: 'h', label: 'H', type: 'int' },
    { key: '2b', label: '2B', type: 'int' },
    { key: '3b', label: '3B', type: 'int' },
    { key: 'hr', label: 'HR', type: 'int' },
    { key: 'r', label: 'R', type: 'int' },
    { key: 'rbi', label: 'RBI', type: 'int' },
    { key: 'bb', label: 'BB', type: 'int' },
    { key: 'hbp', label: 'HBP', type: 'int' },
    { key: 'so', label: 'SO', type: 'int' },
    { key: 'avg', label: 'AVG', type: 'avg' },
    { key: 'obp', label: 'OBP', type: 'avg' },
    { key: 'slg', label: 'SLG', type: 'avg' },
    { key: 'ops', label: 'OPS', type: 'avg' },
    { key: 'sh', label: 'SAC', type: 'int' },
    { key: 'sf', label: 'SF', type: 'int' },
    { key: 'sb', label: 'SB', type: 'int' },
    { key: 'cs', label: 'CS', type: 'int' },
    { key: 'tb', label: 'TB', type: 'int' },
    { key: 'errors', label: 'E', type: 'int' }
  ];

  const PITCHING_COLS = [
    { key: 'last_name', label: 'Last', type: 'text' },
    { key: 'first_name', label: 'First', type: 'text' },
    { key: 'gp', label: 'GP', type: 'int' },
    { key: 'gs', label: 'GS', type: 'int' },
    { key: 'ip', label: 'IP', type: 'ip' },
    { key: 'w', label: 'W', type: 'int' },
    { key: 'l', label: 'L', type: 'int' },
    { key: 'sv', label: 'SV', type: 'int' },
    { key: 'h', label: 'H', type: 'int' },
    { key: 'r', label: 'R', type: 'int' },
    { key: 'er', label: 'ER', type: 'int' },
    { key: 'bb', label: 'BB', type: 'int' },
    { key: 'so', label: 'SO', type: 'int' },
    { key: 'hr_allowed', label: 'HR', type: 'int' },
    { key: 'hbp', label: 'HBP', type: 'int' },
    { key: 'era', label: 'ERA', type: 'era' },
    { key: 'whip', label: 'WHIP', type: 'era' },
    { key: 'baa', label: 'BAA', type: 'avg' }
  ];

  const GAME_BATTING_COLS = [
    { key: 'last_name', label: 'Last', type: 'text' },
    { key: 'first_name', label: 'First', type: 'text' },
    { key: 'ab', label: 'AB', type: 'int' },
    { key: 'r', label: 'R', type: 'int' },
    { key: 'h', label: 'H', type: 'int' },
    { key: 'rbi', label: 'RBI', type: 'int' },
    { key: 'doubles', label: '2B', type: 'int' },
    { key: 'triples', label: '3B', type: 'int' },
    { key: 'hr', label: 'HR', type: 'int' },
    { key: 'bb', label: 'BB', type: 'int' },
    { key: 'so', label: 'SO', type: 'int' },
    { key: 'sf', label: 'SF', type: 'int' },
    { key: 'sh', label: 'SH', type: 'int' },
    { key: 'hbp', label: 'HBP', type: 'int' },
    { key: 'sb', label: 'SB', type: 'int' }
  ];

  const GAME_PITCHING_COLS = [
    { key: 'last_name', label: 'Last', type: 'text' },
    { key: 'first_name', label: 'First', type: 'text' },
    { key: 'ip', label: 'IP', type: 'ip' },
    { key: 'h', label: 'H', type: 'int' },
    { key: 'r', label: 'R', type: 'int' },
    { key: 'er', label: 'ER', type: 'int' },
    { key: 'bb', label: 'BB', type: 'int' },
    { key: 'so', label: 'SO', type: 'int' },
    { key: 'hr', label: 'HR', type: 'int' }
  ];

  function formatVal(val, type) {
    if (val === null || val === undefined) return '-';
    if (type === 'avg') return val === 0 ? '.000' : val.toFixed(3).replace(/^0/, '');
    if (type === 'era') return val.toFixed(2);
    if (type === 'ip') return val;
    return String(val);
  }

  function formatIP(row) {
    if (row.ip_whole !== undefined) return row.ip_whole + '.' + row.ip_remainder;
    if (row.ip_full !== undefined) return row.ip_full + '.' + row.ip_partial;
    return '0';
  }

  function buildTableHeader(cols, thead) {
    const tr = document.createElement('tr');
    cols.forEach((col, i) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.dataset.col = col.key;
      th.dataset.type = col.type;
      th.style.cursor = 'pointer';
      th.classList.add('text-nowrap');
      if (i < 2) th.classList.add('sticky-col');
      tr.appendChild(th);
    });
    thead.innerHTML = '';
    thead.appendChild(tr);
  }

  function buildTableBody(rows, cols, tbody, isPitching) {
    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      cols.forEach((col, i) => {
        const td = document.createElement('td');
        let val = row[col.key];
        if (col.key === 'ip') val = formatIP(row);
        td.textContent = formatVal(val, col.type);
        td.classList.add('text-nowrap');
        if (i < 2) td.classList.add('sticky-col');
        if (col.type !== 'text') td.classList.add('text-end');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function buildTableFooter(totals, cols, tfoot, isPitching) {
    if (!totals) return;
    tfoot.innerHTML = '';
    const tr = document.createElement('tr');
    cols.forEach((col, i) => {
      const td = document.createElement('td');
      td.classList.add('fw-bold', 'text-nowrap');
      if (i === 0) { td.textContent = 'Totals'; }
      else if (i === 1) { td.textContent = ''; }
      else if (col.key === 'ip') { td.textContent = formatIP(totals); }
      else {
        const val = totals[col.key];
        td.textContent = val !== undefined ? formatVal(val, col.type) : '';
      }
      if (i < 2) td.classList.add('sticky-col');
      if (col.type !== 'text') td.classList.add('text-end');
      tr.appendChild(td);
    });
    tfoot.appendChild(tr);
  }

  // Sorting
  let sortState = {};

  function sortTable(table, colKey, colType) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const cols = table.classList.contains('batting-table') ? BATTING_COLS : PITCHING_COLS;
    const colIdx = cols.findIndex(c => c.key === colKey);
    if (colIdx < 0) return;

    const tableId = table.closest('.tab-pane')?.id || 'default';
    const stateKey = tableId + '-' + (table.classList.contains('batting-table') ? 'bat' : 'pitch');

    if (!sortState[stateKey] || sortState[stateKey].col !== colKey) {
      sortState[stateKey] = { col: colKey, asc: colType === 'text' };
    } else {
      sortState[stateKey].asc = !sortState[stateKey].asc;
    }
    const asc = sortState[stateKey].asc;

    rows.sort((a, b) => {
      let va = a.children[colIdx].textContent.trim();
      let vb = b.children[colIdx].textContent.trim();
      if (colType === 'text') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      va = parseFloat(va.replace('.', '').replace('-', '0')) || 0;
      vb = parseFloat(vb.replace('.', '').replace('-', '0')) || 0;
      // For avg types, parse properly
      if (colType === 'avg' || colType === 'era' || colType === 'ip') {
        va = parseFloat(a.children[colIdx].textContent) || 0;
        vb = parseFloat(b.children[colIdx].textContent) || 0;
      } else {
        va = parseInt(a.children[colIdx].textContent) || 0;
        vb = parseInt(b.children[colIdx].textContent) || 0;
      }
      return asc ? va - vb : vb - va;
    });

    rows.forEach(r => tbody.appendChild(r));

    // Update header indicators
    table.querySelectorAll('thead th').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.col === colKey) {
        th.classList.add(asc ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  // Event delegation for sorting
  document.addEventListener('click', e => {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const table = th.closest('table.stat-table');
    if (!table) return;
    sortTable(table, th.dataset.col, th.dataset.type);
  });

  // Data loading
  const loaded = {};

  async function loadAggregateTab(tabId, season) {
    const pane = document.getElementById(tabId);
    if (!pane) return;

    try {
      const [batRes, pitRes] = await Promise.all([
        fetch('/api/stats/batting?season=' + season).then(r => r.json()),
        fetch('/api/stats/pitching?season=' + season).then(r => r.json())
      ]);

      const batTable = pane.querySelector('.batting-table');
      const pitTable = pane.querySelector('.pitching-table');

      buildTableHeader(BATTING_COLS, batTable.querySelector('thead'));
      buildTableBody(batRes.rows, BATTING_COLS, batTable.querySelector('tbody'));
      buildTableFooter(batRes.totals, BATTING_COLS, batTable.querySelector('tfoot'));

      buildTableHeader(PITCHING_COLS, pitTable.querySelector('thead'));
      buildTableBody(batRes.rows.length > 0 ? pitRes.rows : [], PITCHING_COLS, pitTable.querySelector('tbody'), true);
      buildTableFooter(pitRes.totals, PITCHING_COLS, pitTable.querySelector('tfoot'), true);

      pane.querySelector('.stat-loading').style.display = 'none';
      pane.querySelector('.stat-content').style.display = '';
    } catch (err) {
      console.error('Failed to load stats:', err);
      pane.querySelector('.stat-loading').innerHTML = '<div class="text-danger">Failed to load data</div>';
    }
  }

  async function loadGameTab(tabId, season, accordionId) {
    const pane = document.getElementById(tabId);
    if (!pane) return;

    try {
      const games = await fetch('/api/games?season=' + season).then(r => r.json());
      const accordion = document.getElementById(accordionId);
      accordion.innerHTML = '';

      for (const game of games) {
        const detail = await fetch('/api/games/' + game.id).then(r => r.json());
        const resultBadge = game.result === 'W' ? 'bg-success' : game.result === 'L' ? 'bg-danger' : 'bg-secondary';

        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.innerHTML = `
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#game-${game.id}">
              Game ${game.game_number}
              <span class="badge ${resultBadge} ms-2">${game.result || '-'}</span>
            </button>
          </h2>
          <div id="game-${game.id}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
            <div class="accordion-body p-2">
              <h6>Hitting</h6>
              <div class="table-responsive">
                <table class="table table-sm table-striped game-bat-${game.id}">
                  <thead class="table-dark"></thead><tbody></tbody>
                </table>
              </div>
              <h6 class="mt-2">Pitching</h6>
              <div class="table-responsive">
                <table class="table table-sm table-striped game-pit-${game.id}">
                  <thead class="table-dark"></thead><tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        `;
        accordion.appendChild(item);

        const batTable = item.querySelector('.game-bat-' + game.id);
        const pitTable = item.querySelector('.game-pit-' + game.id);

        buildTableHeader(GAME_BATTING_COLS, batTable.querySelector('thead'));
        buildTableBody(detail.batting, GAME_BATTING_COLS, batTable.querySelector('tbody'));

        // Format pitching IP for game detail
        detail.pitching.forEach(p => {
          p.ip = p.ip_full + '.' + p.ip_partial;
        });
        buildTableHeader(GAME_PITCHING_COLS, pitTable.querySelector('thead'));
        buildTableBody(detail.pitching, GAME_PITCHING_COLS, pitTable.querySelector('tbody'), true);
      }

      pane.querySelector('.stat-loading').style.display = 'none';
      pane.querySelector('.stat-content').style.display = '';
    } catch (err) {
      console.error('Failed to load games:', err);
      pane.querySelector('.stat-loading').innerHTML = '<div class="text-danger">Failed to load data</div>';
    }
  }

  function loadTab(season) {
    if (loaded[season]) return;
    loaded[season] = true;

    if (season === 'total') loadAggregateTab('tab-total', 'total');
    else if (season === 'regular') loadAggregateTab('tab-regular', 'regular');
    else if (season === 'postseason') loadAggregateTab('tab-postseason', 'postseason');
    else if (season === 'game-regular') loadGameTab('tab-games', 'regular', 'regularGamesAccordion');
    else if (season === 'game-postseason') loadGameTab('tab-postgames', 'postseason', 'postGamesAccordion');
  }

  // Tab switching
  document.querySelectorAll('#statTabs .nav-link').forEach(tab => {
    tab.addEventListener('shown.bs.tab', () => {
      loadTab(tab.dataset.season);
    });
  });

  // Load initial tab
  loadTab('total');

  // SSE for real-time updates
  function connectSSE() {
    const evtSource = new EventSource('/api/events');
    const badge = document.getElementById('sse-status');

    evtSource.onopen = () => {
      badge.style.display = '';
    };

    evtSource.addEventListener('game-added', () => {
      // Reload all loaded tabs
      Object.keys(loaded).forEach(k => { loaded[k] = false; });
      const activeTab = document.querySelector('#statTabs .nav-link.active');
      if (activeTab) loadTab(activeTab.dataset.season);
    });

    evtSource.addEventListener('game-updated', () => {
      Object.keys(loaded).forEach(k => { loaded[k] = false; });
      const activeTab = document.querySelector('#statTabs .nav-link.active');
      if (activeTab) loadTab(activeTab.dataset.season);
    });

    evtSource.addEventListener('game-deleted', () => {
      Object.keys(loaded).forEach(k => { loaded[k] = false; });
      const activeTab = document.querySelector('#statTabs .nav-link.active');
      if (activeTab) loadTab(activeTab.dataset.season);
    });

    evtSource.onerror = () => {
      badge.style.display = 'none';
      setTimeout(connectSSE, 5000);
    };
  }

  connectSSE();
})();
