// Token Launch Radar dashboard (no network, no framework).
// Reads window.RADAR from ../data.js. Hash routes: #detail=<slug>,
// #filter=<category>, #view=live|model|board.
(function () {
  var D = window.RADAR;
  var rows = D.rows, watch = {};
  D.watchlist.forEach(function (s) { watch[s] = true; });
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  };
  var pct = function (v) {
    if (v === null || v === undefined) return '—';
    var c = v >= 0 ? 'up' : 'down';
    return '<span class="' + c + '">' + (v >= 0 ? '+' : '') + v.toFixed(1) + '%</span>';
  };
  var age = function (d) { return d === null || d === undefined ? '—' : d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd'; };

  $('#meta').textContent = D.rows.length + ' pre-token protocols ranked · snapshot ' + D.as_of +
    ' · watchlist floor ' + fmt(D.floor_usd) + ' · ' + D.watchlist_count + ' on the watchlist';
  $('#asof').textContent = D.as_of;
  $('#foot').textContent = D.rows.length + ' rows, model ' + D.model_version;

  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('#cat').appendChild(o);
  });

  var sortKey = 'rank', sortDir = 1, current = rows.slice();
  function render() {
    var q = ($('#q').value || '').toLowerCase();
    var cat = $('#cat').value;
    var wonly = $('#watchonly').checked;
    current = rows.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      if (wonly && !watch[r.slug]) return false;
      return true;
    });
    current.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    $('#count').textContent = current.length + ' of ' + rows.length + ' shown';
    var tb = document.querySelector('#board tbody');
    tb.innerHTML = current.map(function (r) {
      return '<tr data-slug="' + r.slug + '"><td>' + r.rank + '</td><td><b>' + esc(r.name) + '</b>' +
        (watch[r.slug] ? ' <span class="badge">watchlist</span>' : '') +
        '</td><td>' + esc(r.category || '—') + '</td><td class="chains" title="' + esc(r.chains.join(', ')) + '">' + r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + fmt(r.tvl_usd) + '</td><td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td><td class="num val">' + fmt(r.implied_value_usd) + '</td></tr>';
    }).join('');
    tb.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug')); });
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function showDetail(slug, fromHash) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    var el = $('#detail');
    el.hidden = false;
    el.innerHTML = '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      '<div class="facts"><span>Category <b>' + esc(r.category || '—') + '</b></span>' +
      '<span>Chains <b>' + r.chains.join(', ') + '</b></span>' +
      '<span>TVL <b>' + fmt(r.tvl_usd) + '</b></span>' +
      '<span>7d <b>' + pct(r.change_7d) + '</b></span>' +
      '<span>Age <b>' + age(r.age_days) + '</b></span>' +
      '<span>Implied value <b>' + fmt(r.implied_value_usd) + '</b></span></div>' +
      '<p>Value model: TVL × <code>' + r.multiple.toFixed(3) + '</code> (' + esc(r.multiple_source) + ') × growth <code>' +
      r.growth_multiplier.toFixed(3) + '</code> × maturity <code>' + r.maturity_multiplier.toFixed(3) +
      '</code> × chains <code>' + r.chain_multiplier.toFixed(2) + '</code>.</p>' +
      '<h3>How to farm it</h3><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    if (fromHash) {
      // Opened from a link: put the detail first so it is visible at once.
      var board = $('#view-board');
      board.insertBefore(el, board.querySelector('table'));
      window.scrollTo(0, 0);
    } else {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    if (location.hash !== '#detail=' + slug) history.replaceState(null, '', '#detail=' + slug);
  }

  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
      render();
    });
  });
  $('#q').addEventListener('input', render);
  $('#cat').addEventListener('change', render);
  $('#watchonly').addEventListener('change', render);

  // Live view
  document.querySelector('#livetab tbody').innerHTML = D.live.map(function (r) {
    return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.category || '—') + '</td><td class="num">' +
      fmt(r.tvl_usd) + '</td><td class="num">' + fmt(r.mcap_usd) + '</td><td class="num">' +
      (r.fdv_tvl === null ? '—' : r.fdv_tvl.toFixed(3)) + '</td><td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');
  // Model view
  document.querySelector('#mults tbody').innerHTML = D.multiples.map(function (m) {
    return '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.multiple.toFixed(3) +
      '</td><td class="num">' + m.n + '</td></tr>';
  }).join('') + '<tr><td><b>Overall fallback</b></td><td class="num"><b>' + D.overall_multiple.toFixed(3) +
    '</b></td><td class="num">—</td></tr>' +
    (D.power_law ? '<tr><td><b>Power-law fit</b></td><td class="num">log<sub>10</sub>(mcap) = ' + D.power_law.intercept.toFixed(3) + ' + ' + D.power_law.slope.toFixed(3) + '·log<sub>10</sub>(TVL), n=' + D.power_law.n + ', weight ' + D.power_law.weight + '</td><td class="num">' + D.power_law.n + '</td></tr>' : '');

  function showView(v) {
    ['board', 'live', 'model'].forEach(function (x) { $('#view-' + x).hidden = x !== v; });
    document.querySelectorAll('nav button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
  }
  document.querySelectorAll('nav button').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });

  // Hash routes for screenshots: #detail=<slug>, #filter=<category>, #view=live|model
  var h = location.hash || '';
  var m;
  if ((m = h.match(/#view=(board|live|model)/))) showView(m[1]);
  if ((m = h.match(/#filter=([^&]+)/))) { $('#cat').value = decodeURIComponent(m[1]); }
  render();
  if ((m = h.match(/#detail=([^&]+)/))) showDetail(decodeURIComponent(m[1]), true);
})();
