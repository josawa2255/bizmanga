/* Keep wide editorial tables scrollable without changing their cells or sanitization. */
(function() {
  'use strict';
  document.querySelectorAll('.bm-col-static-content, .bm-col-detail-content').forEach(function(content) {
    function wrapTables() {
      content.querySelectorAll('table').forEach(function(table) {
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
    new MutationObserver(wrapTables).observe(content, { childList: true, subtree: true });
  });
})();
