import fs from "node:fs";
import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL(process.env.TEMP + "/jpconv/node_modules/to-jyutping/dist/index.cjs").href);
const toJyutping = mod.default;

// EDB 標準校正 (轉換器與 EDB 單字讀音衝突時, 以 EDB 為準) + 字母補讀
const OVERRIDES = {
  "天涯若比鄰": "tin1 ngaai4 joek6 bei2 leon4",
  "大聲疾呼": "daai6 sing1 zat6 fu1",
  "T恤衫": "ti1 seot1 saam1",
};

const words = fs.readFileSync("csv/edb_unmatched.txt", "utf8").trim().split(/\r?\n/).filter(Boolean);
const isCjk = c => /[㐀-鿿豈-﫿]/.test(c);
const cleanTok = t => t.replace(/[^a-zA-Z0-9]/g, "");
const isJp = t => /^[a-z]+[1-6]$/.test(t);

const rows = [];
const warn = [];
for (const w of words) {
  let jp;
  if (OVERRIDES[w]) {
    jp = OVERRIDES[w];
  } else {
    const tokens = toJyutping.getJyutpingText(w).split(/\s+/).map(cleanTok).filter(isJp);
    const chars = [...w].filter(isCjk);
    if (tokens.length !== chars.length) warn.push(`${w}: ${tokens.length} vs ${chars.length}`);
    jp = tokens.join(" ");
  }
  rows.push([w, jp]);
}
fs.writeFileSync("csv/edb_jyutping_extra.csv",
  "﻿word,jyutping\n" + rows.map(r => r.join(",")).join("\n") + "\n");
console.log("written " + rows.length + " rows");
if (warn.length) console.log("WARN: " + warn.join(" | "));
