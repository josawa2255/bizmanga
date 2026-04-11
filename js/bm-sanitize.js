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
    // 相対URL
    if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../') || !s.includes('://')) {
      return s;
    }
    // 許可ドメイン
    var allowed = ['contentsx.jp', 'bizmanga.contentsx.jp', 'cms.contentsx.jp'];
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

  // グローバル公開
  window.bmSanitize = {
    html: escapeHtml,
    url: sanitizeUrl
  };
})();
