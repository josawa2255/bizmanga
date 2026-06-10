/**
 * BizManga — HTML サニタイズユーティリティ
 * XSS防止: APIレスポンスをDOMに挿入する前にエスケープ
 */
(function() {
  'use strict';

  /**
   * HTMLエスケープ（textContentの代替としてinnerHTMLに安全に挿入）
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * URL検証（相対URLまたは自社ドメインのみ許可）
   */
  function sanitizeUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    // 制御文字・空白の混入（"java\tscript:" 等のスキーム偽装）は拒否
    if (/[\u0000-\u0020\u007f]/.test(s)) return '';
    // プロトコル相対URL (//evil.com) は外部ドメインに化けるので拒否
    if (s.startsWith('//')) return '';
    // スキーム付き (javascript:, data:, vbscript: 等を含む) は http/https のみ許可ドメインで通す
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      var allowed = ['contentsx.jp'];
      try {
        var parsed = new URL(s);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        var host = parsed.hostname;
        for (var i = 0; i < allowed.length; i++) {
          if (host === allowed[i] || host.endsWith('.' + allowed[i])) return s;
        }
      } catch (e) { /* invalid URL */ }
      return '';
    }
    // スキーム無し = 相対URL（/path, ./path, path, #hash, ?query）
    return s;
  }

  /**
   * WP APIから返るHTML本文を安全化
   * script/iframe/style等の危険タグを除去し、on属性やjavascript:URIをstripする
   */
  function sanitizeRichHTML(raw) {
    var tmp = document.createElement('div');
    tmp.innerHTML = raw || '';
    tmp.querySelectorAll('script,iframe,object,embed,base,form,meta,link,style,svg,math,noscript,template').forEach(function(el) { el.remove(); });
    tmp.querySelectorAll('*').forEach(function(el) {
      Array.from(el.attributes).forEach(function(attr) {
        var v = attr.value.trim().toLowerCase().replace(/[\t\n\r]/g, '');
        if (attr.name.startsWith('on') || v.startsWith('javascript:') || v.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return tmp.innerHTML;
  }

  window.bmSanitize = {
    html: escapeHtml,
    url: sanitizeUrl,
    rich: sanitizeRichHTML,
    richHTML: sanitizeRichHTML // 旧呼び名エイリアス（呼び間違い事故防止）
  };
})();
