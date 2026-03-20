(function() {
  'use strict';

  let allPlayers = [];
  let gameData = {
    seasonType: null,
    gameTag: null,
    opponent: '',
    homeAway: null,
    result: null,
    selectedBatters: [],
    selectedPitchers: [],
    batting: [],
    pitching: []
  };

  const stepLabels = ['Season Type', 'Select Batters', 'Batting Stats', 'Select Pitchers', 'Pitching Stats', 'Review'];

  // Load players
  fetch('/api/players').then(r => r.json()).then(players => {
    allPlayers = players;
    buildBatterChecklist();
    buildPitcherChecklist();
  });

  // Step navigation
  window.goStep = function(n) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + n).classList.add('active');
    document.getElementById('currentStep').textContent = n;
    document.getElementById('stepLabel').textContent = stepLabels[n - 1] || '';
    document.getElementById('progressBar').style.width = (n / 6 * 100) + '%';
  };

  // Step 1: Season Type & Result
  document.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active', 'btn-primary'));
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-primary');
      document.querySelectorAll('.season-btn').forEach(b => {
        if (b !== btn) { b.classList.add('btn-outline-primary'); b.classList.remove('btn-primary'); }
      });
      gameData.seasonType = btn.dataset.season;
      checkStep1();
    });
  });

  document.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.result-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace(/btn-(success|danger|secondary)/, 'btn-outline-$1');
      });
      btn.classList.add('active');
      btn.className = btn.className.replace('btn-outline-', 'btn-');
      gameData.result = btn.dataset.result;
      checkStep1();
    });
  });

  // Opponent name
  document.getElementById('opponentName').addEventListener('input', (e) => {
    gameData.opponent = e.target.value.trim();
    checkStep1();
  });

  // Home/Away buttons
  document.querySelectorAll('.ha-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ha-btn').forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-outline-primary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-primary');
      gameData.homeAway = btn.dataset.ha;
      checkStep1();
    });
  });

  // Game tag buttons
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tag-btn').forEach(b => {
        b.classList.remove('active');
        b.className = b.className.replace(/btn-(info|warning|secondary)(?!-)/, 'btn-outline-$1');
      });
      btn.classList.add('active');
      btn.className = btn.className.replace('btn-outline-', 'btn-');
      gameData.gameTag = btn.dataset.tag;
      checkStep1();
    });
  });

  function checkStep1() {
    document.getElementById('step1Next').disabled = !(gameData.seasonType && gameData.gameTag && gameData.opponent && gameData.homeAway && gameData.result);
  }

  document.getElementById('step1Next').addEventListener('click', () => goStep(2));

  // Step 2: Batter checklist
  function buildBatterChecklist() {
    const container = document.getElementById('batterChecklist');
    container.innerHTML = '';
    allPlayers.forEach(p => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3';
      col.innerHTML = `
        <label class="player-check d-flex align-items-center">
          <input type="checkbox" class="form-check-input batter-check" value="${p.id}" data-name="${p.last_name}, ${p.first_name}">
          <span>${p.last_name}, ${p.first_name} <small class="text-muted">(${p.class_year || ''})</small></span>
        </label>`;
      container.appendChild(col);
    });
  }

  document.getElementById('selectAllBatters').addEventListener('click', () => {
    document.querySelectorAll('.batter-check').forEach(cb => cb.checked = true);
  });
  document.getElementById('deselectAllBatters').addEventListener('click', () => {
    document.querySelectorAll('.batter-check').forEach(cb => cb.checked = false);
  });

  document.getElementById('step2Next').addEventListener('click', () => {
    gameData.selectedBatters = [];
    document.querySelectorAll('.batter-check:checked').forEach(cb => {
      const player = allPlayers.find(p => p.id === parseInt(cb.value));
      if (player) gameData.selectedBatters.push(player);
    });
    if (gameData.selectedBatters.length === 0) {
      alert('Please select at least one batter.');
      return;
    }
    buildBattingEntryTable();
    goStep(3);
  });

  // Step 3: Batting entry table
  function buildBattingEntryTable() {
    const tbody = document.querySelector('#battingEntryTable tbody');
    tbody.innerHTML = '';
    const fields = ['ab','r','h','rbi','doubles','triples','hr','bb','so','sf','sh','hbp','sb','cs'];
    gameData.selectedBatters.forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.playerId = p.id;
      tr.innerHTML = `<td class="text-nowrap fw-bold">${p.last_name}, ${p.first_name}</td>` +
        fields.map(f => `<td><input type="number" min="0" max="99" value="0" class="form-control form-control-sm" data-field="${f}"></td>`).join('');
      tbody.appendChild(tr);
    });
  }

  document.getElementById('step3Next').addEventListener('click', () => {
    const errors = validateBatting();
    document.getElementById('battingErrors').textContent = errors;
    if (errors) return;
    collectBattingData();
    goStep(4);
  });

  function validateBatting() {
    const rows = document.querySelectorAll('#battingEntryTable tbody tr');
    const errs = [];
    rows.forEach(row => {
      const name = row.children[0].textContent;
      const vals = {};
      row.querySelectorAll('input').forEach(inp => {
        vals[inp.dataset.field] = parseInt(inp.value) || 0;
      });
      if (vals.h > vals.ab) errs.push(`${name}: H (${vals.h}) > AB (${vals.ab})`);
      if (vals.doubles + vals.triples + vals.hr > vals.h) errs.push(`${name}: 2B+3B+HR > H`);
    });
    return errs.join('; ');
  }

  function collectBattingData() {
    gameData.batting = [];
    document.querySelectorAll('#battingEntryTable tbody tr').forEach(row => {
      const entry = { player_id: parseInt(row.dataset.playerId) };
      row.querySelectorAll('input').forEach(inp => {
        entry[inp.dataset.field] = parseInt(inp.value) || 0;
      });
      gameData.batting.push(entry);
    });
  }

  // Step 4: Pitcher checklist
  function buildPitcherChecklist() {
    const container = document.getElementById('pitcherChecklist');
    container.innerHTML = '';
    allPlayers.forEach(p => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3';
      col.innerHTML = `
        <label class="player-check d-flex align-items-center">
          <input type="checkbox" class="form-check-input pitcher-check" value="${p.id}"
            data-name="${p.last_name}, ${p.first_name}" ${p.is_pitcher ? 'data-pitcher="1"' : ''}>
          <span>${p.last_name}, ${p.first_name}
            ${p.is_pitcher ? '<span class="badge bg-info ms-1">P</span>' : ''}
          </span>
        </label>`;
      container.appendChild(col);
    });
  }

  document.getElementById('selectAllPitchers').addEventListener('click', () => {
    document.querySelectorAll('.pitcher-check[data-pitcher]').forEach(cb => cb.checked = true);
  });

  document.getElementById('step4Next').addEventListener('click', () => {
    gameData.selectedPitchers = [];
    document.querySelectorAll('.pitcher-check:checked').forEach(cb => {
      const player = allPlayers.find(p => p.id === parseInt(cb.value));
      if (player) gameData.selectedPitchers.push(player);
    });
    if (gameData.selectedPitchers.length === 0) {
      alert('Please select at least one pitcher.');
      return;
    }
    buildPitchingEntryTable();
    goStep(5);
  });

  // Step 5: Pitching entry table
  function buildPitchingEntryTable() {
    const tbody = document.querySelector('#pitchingEntryTable tbody');
    tbody.innerHTML = '';
    gameData.selectedPitchers.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.playerId = p.id;
      tr.innerHTML = `
        <td class="text-nowrap fw-bold">${p.last_name}, ${p.first_name}</td>
        <td><input type="number" min="0" max="20" value="0" class="form-control form-control-sm" data-field="ip_full"></td>
        <td><select class="form-select form-select-sm" data-field="ip_partial" style="width:60px">
          <option value="0">0</option><option value="1">1</option><option value="2">2</option>
        </select></td>
        <td><input type="number" min="0" max="30" value="0" class="form-control form-control-sm" data-field="h"></td>
        <td><input type="number" min="0" max="30" value="0" class="form-control form-control-sm" data-field="r"></td>
        <td><input type="number" min="0" max="30" value="0" class="form-control form-control-sm" data-field="er"></td>
        <td><input type="number" min="0" max="20" value="0" class="form-control form-control-sm" data-field="bb"></td>
        <td><input type="number" min="0" max="25" value="0" class="form-control form-control-sm" data-field="so"></td>
        <td><input type="number" min="0" max="10" value="0" class="form-control form-control-sm" data-field="hr"></td>
        <td><input type="number" min="0" max="10" value="0" class="form-control form-control-sm" data-field="hbp"></td>
        <td><input type="checkbox" class="form-check-input" data-field="gs" ${idx === 0 ? 'checked' : ''}></td>
        <td><input type="checkbox" class="form-check-input" data-field="w"></td>
        <td><input type="checkbox" class="form-check-input" data-field="l"></td>
        <td><input type="checkbox" class="form-check-input" data-field="sv"></td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('step5Next').addEventListener('click', () => {
    const errors = validatePitching();
    document.getElementById('pitchingErrors').textContent = errors;
    if (errors) return;
    collectPitchingData();
    buildReview();
    goStep(6);
  });

  function validatePitching() {
    const rows = document.querySelectorAll('#pitchingEntryTable tbody tr');
    const errs = [];
    rows.forEach(row => {
      const name = row.children[0].textContent;
      const vals = {};
      row.querySelectorAll('input, select').forEach(inp => {
        if (inp.type === 'checkbox') vals[inp.dataset.field] = inp.checked ? 1 : 0;
        else vals[inp.dataset.field] = parseInt(inp.value) || 0;
      });
      if (vals.er > vals.r) errs.push(`${name}: ER (${vals.er}) > R (${vals.r})`);
    });
    return errs.join('; ');
  }

  function collectPitchingData() {
    gameData.pitching = [];
    document.querySelectorAll('#pitchingEntryTable tbody tr').forEach(row => {
      const entry = { player_id: parseInt(row.dataset.playerId) };
      row.querySelectorAll('input, select').forEach(inp => {
        if (inp.type === 'checkbox') entry[inp.dataset.field] = inp.checked ? 1 : 0;
        else entry[inp.dataset.field] = parseInt(inp.value) || 0;
      });
      gameData.pitching.push(entry);
    });
  }

  // Step 6: Review
  function buildReview() {
    const div = document.getElementById('reviewSummary');
    const teamR = gameData.batting.reduce((s, b) => s + b.r, 0);
    const teamH = gameData.batting.reduce((s, b) => s + b.h, 0);
    const teamRBI = gameData.batting.reduce((s, b) => s + b.rbi, 0);
    const teamER = gameData.pitching.reduce((s, p) => s + p.er, 0);
    const teamRA = gameData.pitching.reduce((s, p) => s + p.r, 0);

    const tagLabels = { conference: 'Conference', non_conference: 'Non-Conference', exhibition: 'Exhibition' };
    const haLabel = gameData.homeAway === 'home' ? 'vs' : '@';
    div.innerHTML = `
      <div class="row mb-3">
        <div class="col-md-6">
          <strong>Moeller ${haLabel} ${gameData.opponent}</strong>
        </div>
        <div class="col-md-6 text-end">
          <span class="badge ${gameData.result === 'W' ? 'bg-success' : gameData.result === 'L' ? 'bg-danger' : 'bg-secondary'}">${gameData.result}</span>
          <span class="badge bg-info">${tagLabels[gameData.gameTag] || gameData.gameTag}</span>
          <span class="badge bg-dark">${gameData.seasonType === 'regular' ? 'Regular' : 'Postseason'}</span>
        </div>
      </div>
      <div class="row mb-2">
        <div class="col">
          <strong>Team Batting:</strong> ${teamR} R, ${teamH} H, ${teamRBI} RBI
          | <strong>Runs Allowed:</strong> ${teamRA} (${teamER} ER)
        </div>
      </div>
      <h6 class="mt-3">Batting (${gameData.batting.length} players)</h6>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead><tr>
            <th>Player</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>2B</th><th>3B</th><th>HR</th><th>BB</th><th>SO</th>
          </tr></thead>
          <tbody>
            ${gameData.batting.map(b => {
              const p = allPlayers.find(pl => pl.id === b.player_id);
              return `<tr><td>${p ? p.last_name + ', ' + p.first_name : 'Unknown'}</td>
                <td>${b.ab}</td><td>${b.r}</td><td>${b.h}</td><td>${b.rbi}</td>
                <td>${b.doubles}</td><td>${b.triples}</td><td>${b.hr}</td><td>${b.bb}</td><td>${b.so}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <h6 class="mt-3">Pitching (${gameData.pitching.length} players)</h6>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead><tr>
            <th>Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>SO</th><th>W</th><th>L</th><th>SV</th>
          </tr></thead>
          <tbody>
            ${gameData.pitching.map(pt => {
              const p = allPlayers.find(pl => pl.id === pt.player_id);
              return `<tr><td>${p ? p.last_name + ', ' + p.first_name : 'Unknown'}</td>
                <td>${pt.ip_full}.${pt.ip_partial}</td><td>${pt.h}</td><td>${pt.r}</td><td>${pt.er}</td>
                <td>${pt.bb}</td><td>${pt.so}</td>
                <td>${pt.w ? 'W' : ''}</td><td>${pt.l ? 'L' : ''}</td><td>${pt.sv ? 'SV' : ''}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Submit
  document.getElementById('submitGame').addEventListener('click', async () => {
    const btn = document.getElementById('submitGame');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonType: gameData.seasonType,
          gameTag: gameData.gameTag,
          opponent: gameData.opponent,
          homeAway: gameData.homeAway,
          result: gameData.result,
          batters: gameData.batting,
          pitchers: gameData.pitching
        })
      });

      const data = await res.json();
      if (data.success) {
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
        document.getElementById('stepDone').classList.add('active');
        document.getElementById('progressBar').style.width = '100%';
      } else {
        document.getElementById('submitError').textContent = data.error || 'Submission failed';
        document.getElementById('submitError').style.display = '';
        btn.disabled = false;
        btn.textContent = 'Submit Game';
      }
    } catch (err) {
      document.getElementById('submitError').textContent = 'Network error: ' + err.message;
      document.getElementById('submitError').style.display = '';
      btn.disabled = false;
      btn.textContent = 'Submit Game';
    }
  });
})();
