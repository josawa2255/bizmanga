/**
 * クライアント企業ロゴ — 親会社 Contents X のロゴ群を絶対URLで参照。
 * Cホーム (contentsx.jp) と同じデータを共有しているが、BizManga (別ドメイン)
 * から読み込むため画像URLは https://contentsx.jp/... の絶対パスを使う。
 *
 * 拡張時は ContentX/js/data/client-logos.js と同期させること。
 */
const CLIENT_LOGOS = [
  { name: 'MACNICA',            logo: 'https://contentsx.jp/material/images/clients/macnica.png' },
  { name: '日能研',              logo: 'https://contentsx.jp/material/images/clients/nichinoken.png' },
  { name: 'Birdman',            logo: 'https://contentsx.jp/material/images/clients/birdman.png' },
  { name: 'ガウディア',           logo: 'https://contentsx.jp/material/images/clients/gaudia.png' },
  { name: 'LIFE Entertainment', logo: 'https://contentsx.jp/material/images/clients/life-entertainment.png' },
  { name: 'ICHINOHE HOME',      logo: 'https://contentsx.jp/material/images/clients/ichinohe-home.png' },
  { name: 'StockSun',           logo: 'https://contentsx.jp/material/images/clients/stocksun.png' },
  { name: 'Japanese Dream',     logo: 'https://contentsx.jp/material/images/clients/japanese-dream.png' },
  { name: 'FRESH CAREER',       logo: 'https://contentsx.jp/material/images/clients/fresh-career.png' },
  { name: 'HRM',                logo: 'https://contentsx.jp/material/images/clients/hrm.png' },
  { name: 'ASOBI SYSTEM',       logo: 'https://contentsx.jp/material/images/partners/asobi-system.webp', url: 'https://asobisystem.com/' },
  { name: 'DM Solutions',       logo: 'https://contentsx.jp/material/images/partners/dm-solutions.webp', url: 'https://www.dm-s.co.jp/' },
  { name: 'KIRINZ',             logo: 'https://contentsx.jp/material/images/partners/kirinz.webp',       url: 'https://kirinz.tokyo/' }
];
