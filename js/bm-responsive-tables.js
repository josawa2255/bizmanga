/* Keep wide editorial tables scrollable without changing their cells or sanitization. */
(function() {
  'use strict';
  function sizeColumns(table) {
    var occupied = [];
    var columns = 1;
    var group = null;
    Array.from(table.rows).forEach(function(row) {
      // Row spans stop at their row group, including rowspan="0".
      if (row.parentElement !== group) {
        occupied = [];
        group = row.parentElement;
      }
      var column = 0;
      Array.from(row.cells).forEach(function(cell) {
        while (occupied[column] > 0) column++;
        var span = cell.colSpan;
        var rows = cell.rowSpan || group.rows.length - row.sectionRowIndex;
        cell.style.setProperty('--bm-table-cell-columns', span);
        for (var i = column; i < column + span; i++) occupied[i] = rows;
        column += span;
        columns = Math.max(columns, column);
      });
      occupied = occupied.map(function(rows) { return Math.max(0, rows - 1); });
    });
    table.style.setProperty('--bm-table-columns', columns);
  }
  document.querySelectorAll('.bm-col-static-content, .bm-col-detail-content').forEach(function(content) {
    function wrapTables() {
      content.querySelectorAll('table').forEach(function(table) {
        sizeColumns(table);
        if (table.closest('.bm-table-scroll')) return;
        var wrap = document.createElement('div');
        wrap.className = 'bm-table-wrap';
        var hint = document.createElement('p');
        hint.className = 'bm-table-hint';
        hint.textContent = '表は左右にスクロールできます →';
        hint.hidden = true;
        var scroll = document.createElement('div');
        scroll.className = 'bm-table-scroll';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(hint);
        wrap.appendChild(scroll);
        scroll.appendChild(table);
        function update() {
          var overflows = scroll.scrollWidth > scroll.clientWidth + 1;
          hint.hidden = !overflows;
          if (overflows) {
            scroll.setAttribute('tabindex', '0');
            scroll.setAttribute('role', 'region');
            scroll.setAttribute('aria-label', '左右にスクロールできる表');
          } else {
            scroll.removeAttribute('tabindex');
            scroll.removeAttribute('role');
            scroll.removeAttribute('aria-label');
          }
        }
        if ('ResizeObserver' in window) {
          var sizes = new ResizeObserver(update);
          sizes.observe(scroll);
          sizes.observe(table);
        } else {
          window.addEventListener('resize', update);
        }
        update();
      });
    }
    wrapTables();
    // The dynamic detail inserts sanitized WP content after the deferred scripts run.
    new MutationObserver(wrapTables).observe(content, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['colspan', 'rowspan']
    });
  });
})();
