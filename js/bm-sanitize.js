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
   * 静的ビルドの tools/bm_html.py の site_url と同じ方針。回帰ケースは tools/fixtures/site-urls.json
   */
  function sanitizeUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    // 制御文字・空白の混入（"java\tscript:" 等のスキーム偽装）と、バックスラッシュは拒否。
    // ブラウザは \ を / と読むので、"/\evil.example/x" はプロトコル相対URL（外部ドメイン）に化ける
    if (/[\u0000-\u0020\u007f\\]/.test(s)) return '';
    // プロトコル相対URL (//evil.com) は外部ドメインに化けるので拒否
    if (s.startsWith('//')) return '';
    // スキーム付き (javascript:, data:, vbscript: 等を含む) は「http(s)://」＋許可ドメインのものだけ通す。
    // ホスト名は書かれたままの文字で判定する（user@ や %エンコード・全角など、ブラウザが読むホスト名と
    // 見た目がずれる書き方は通さない）
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      return /^https?:\/\/(?:[a-z0-9-]+\.)*contentsx\.jp(?::[0-9]{1,5})?(?:[\/?#]|$)/i.test(s) ? s : '';
    }
    // スキーム無し = 相対URL（/path, ./path, path, #hash, ?query）
    return s;
  }

  // 記事本文は外部リンクも許可するため、ドメインを制限するsanitizeUrlとは分ける。
  // tools/bm_html.pyと同じURLポリシー。制御文字はtrimより先に拒否する。
  function safeRichUrl(value, link, image) {
    if (/[\u0000-\u001f\u007f]/.test(value)) return null;
    var v = value.trim();
    var scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(v);
    if (!scheme) return v;
    var protocol = scheme[1].toLowerCase();
    if (protocol === 'http' || protocol === 'https' ||
        (link && (protocol === 'mailto' || protocol === 'tel'))) return v;
    if (image && /^data:image\/(?:png|gif|jpeg|webp|avif|bmp|x-icon);base64,[a-zA-Z0-9+/=]+$/i.test(v)) return v;
    return null;
  }

  function safeRichSrcset(value) {
    if (/[\u0000-\u001f\u007f]/.test(value)) return null;
    var parts = value.split(',').map(function(chunk) { return chunk.trim(); }).filter(Boolean);
    // data URLはカンマ区切りと曖昧になるため、srcsetには許可しない。
    if (!parts.length || parts.some(function(chunk) {
      return safeRichUrl(chunk.split(/\s+/)[0], false, false) === null;
    })) return null;
    return parts.join(', ');
  }

  /** WP APIから返るHTML本文を安全化する。 */
  function sanitizeRichHTML(raw) {
    var tmp = document.createElement('div');
    tmp.innerHTML = raw || '';
    tmp.querySelectorAll('script,iframe,object,embed,base,form,meta,link,style,svg,math,noscript,template').forEach(function(el) { el.remove(); });
    tmp.querySelectorAll('*').forEach(function(el) {
      Array.from(el.attributes).forEach(function(attr) {
        var name = attr.name.toLowerCase();
        var value = attr.value;
        if (name.startsWith('on') || name === 'srcdoc') {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === 'srcset') {
          value = safeRichSrcset(value);
        } else if (['href', 'src', 'action', 'formaction', 'poster', 'background', 'cite', 'xlink:href'].indexOf(name) !== -1) {
          value = safeRichUrl(value,
            name === 'href' && (el.localName === 'a' || el.localName === 'area'),
            name === 'src' && el.localName === 'img');
        }
        if (value === null) el.removeAttribute(attr.name);
        else if (value !== attr.value) el.setAttribute(attr.name, value);
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
