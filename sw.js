/*
 * 在庫・簿外ノートの service worker。
 * 画面の部品（このフォルダのファイルと Google Fonts）をスマホにしまい、電波がなくても画面が開くようにする。
 * 画面（HTML）は毎回まずネットから取り、取れないときだけしまった分を使う（直した画面がすぐ届くように）。
 * 記録の読み書き（Apps Script への POST）はここを通さない。
 * 画面のファイルを変えたら VERSION を上げる（古いしまい分を消すため）。
 */
const VERSION = "zaiko-v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !fonts) return;

  if (req.mode === "navigate"){
    // ネット優先。#url=…（設定用リンク）や ?… が付いていても、しまった画面で開けるようにする
    e.respondWith(fetch(req).then(res => {
      if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put("./", copy)); }
      return res;
    }).catch(() => caches.match("./")));
    return;
  }
  // それ以外はしまった分を先に返し、裏で新しいものに入れ替える
  e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
    const net = fetch(req)
      .then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; })
      .catch(() => hit || Response.error());
    return hit || net;
  })));
});
