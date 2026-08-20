# -*- coding: utf-8 -*-
"""抓取香港教育局《香港小學學習字詞表》: https://www.edbchinese.hk/lexlist_ch/

用法:
  python scrape_edb.py charlist  依總筆畫數 1-32 枚舉全部漢字 (id -> 字)
  python scrape_edb.py details   抓取每個字的 result.jsp 詳情頁 (3 線程, 可斷點續傳)
  python scrape_edb.py parse     離線解析 raw/*.html, 產出 CSV 與 edb-vocab.js
  python scrape_edb.py all       依序執行以上三步
"""
import csv
import html
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://www.edbchinese.hk/lexlist_ch/"
ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "raw")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "Chrome/126.0 Safari/537.36 (wordlist research)"
)
GOOD_SIZE = 8000  # 正常 result 頁面約 15-30 KB, 找不到條目的頁面約 6 KB
WORKERS = 3


def fetch(url, data=None, retries=3):
    body = urllib.parse.urlencode(data).encode("utf-8") if data else None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as exc:
            print(f"  ! fetch fail ({exc}), retry {attempt}/{retries}", flush=True)
            time.sleep(3 * attempt)
    return None


def polite_delay():
    time.sleep(0.8 + random.random() * 0.8)


def stage_charlist():
    os.makedirs(RAW, exist_ok=True)
    chars = {}
    for strokes in range(1, 33):
        page = fetch(
            BASE + "charlist.jsp",
            {"searchMethod": "stk", "searchCriteria": str(strokes),
             "sortBy": "stroke", "jpC": "lshk"},
        )
        if page is None:
            print(f"strokes {strokes}: fetch failed, skipped", flush=True)
            continue
        with open(os.path.join(RAW, f"charlist_{strokes}.html"), "w", encoding="utf-8") as fh:
            fh.write(page)
        found = re.findall(
            r'href="result\.jsp\?id=(\d+)[^"]*"[^>]*>(.*?)</a>', page, re.S)
        for cid, text in found:
            text = strip_tags(text)
            if text:
                chars[cid] = text
        print(f"strokes {strokes:>2}: {len(found)} chars", flush=True)
        polite_delay()
    with open(os.path.join(RAW, "charlist.json"), "w", encoding="utf-8") as fh:
        json.dump(chars, fh, ensure_ascii=False, indent=1)
    print(f"total {len(chars)} chars", flush=True)


def _fetch_one(job):
    cid, char = job
    path = os.path.join(RAW, f"char_{cid}.html")
    if os.path.exists(path) and os.path.getsize(path) >= GOOD_SIZE:
        return cid, char, True
    page = fetch(f"{BASE}result.jsp?id={cid}&sortBy=stroke&jpC=lshk")
    polite_delay()
    if page is None or "找不到合乎搜尋條件" in page:
        return cid, char, False
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    return cid, char, True


def stage_details():
    with open(os.path.join(RAW, "charlist.json"), encoding="utf-8") as fh:
        chars = json.load(fh)
    ids = sorted(chars, key=lambda x: int(x))
    failed = []
    done = 0
    jobs = [(cid, chars[cid]) for cid in ids]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for idx, (cid, char, ok) in enumerate(pool.map(_fetch_one, jobs), 1):
            if ok:
                done += 1
            else:
                failed.append(cid)
                print(f"  ! id={cid} bad page", flush=True)
            if idx % 100 == 0:
                print(f"progress {idx}/{len(ids)} (ok {done})", flush=True)
    with open(os.path.join(RAW, "failed.json"), "w", encoding="utf-8") as fh:
        json.dump(failed, fh, ensure_ascii=False)
    print(f"details done: ok {done}/{len(ids)}, failed {len(failed)}", flush=True)


def strip_tags(text):
    text = re.sub(r"(?s)<script.*?</script>", "", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_page(page):
    """回傳 (字讀音列表, [(詞, 粵拼, ks集合)], [四字詞], [熟語])"""
    readings = []
    words = []
    idioms = []
    phrases = []

    # 單字粵音: <span class="jyutping12"><strong> ngo5<span ...>...</span></strong></span>
    for chunk in re.findall(r'class="jyutping12"><strong>(.*?)</strong>', page, re.S):
        text = strip_tags(chunk)
        if text:
            readings.append(text)

    # 小學學習字詞表 (tblCi)
    tbl = re.search(r'(?s)id="tblCi".*?</table>', page)
    if tbl:
        for row_m in re.finditer(
                r'(?s)<tr\s+class="([^"]*)"[^>]*>(.*?)</tr>', tbl.group(0)):
            classes, row = row_m.group(1), row_m.group(2)
            if "ks" not in classes:
                continue
            word_m = re.search(r'(?s)class="ci"[^>]*>(.*?)</td>', row)
            jp_m = re.search(r'(?s)class="jyutping\w*"[^>]*>(.*?)</div>', row)
            if not word_m:
                continue
            word = strip_tags(word_m.group(1))
            jp = strip_tags(jp_m.group(1)) if jp_m else ""
            if word:
                ks = {c for c in ("ks1", "ks2") if c in classes}
                if "ks12" in classes:
                    ks = {"ks1", "ks2"}
                words.append((word, jp, ks))

    # 附表一 四字詞語 / 附表二 多字熟語 (原站無注音, 只收詞形)
    seg1 = re.search(r"(?s)附表一(.*?)(?:附表二|footer)", page)
    if seg1:
        for cell in re.findall(r'(?s)<td[^>]*class="ci"[^>]*>(.*?)</td>', seg1.group(1)):
            word = strip_tags(cell)
            if re.search(r"[一-鿿]", word):
                idioms.append(word)
    seg2 = re.search(r"(?s)附表二(.*?)footer", page)
    if seg2:
        for cell in re.findall(r'(?s)<td[^>]*class="ci"[^>]*>(.*?)</td>', seg2.group(1)):
            word = strip_tags(cell)
            if re.search(r"[一-鿿]", word):
                phrases.append(word)
    return readings, words, idioms, phrases


def words_to_js(entries):
    items = []
    for word, jp in entries:
        syllables = jp.split()
        chars = ([{"c": c, "jp": s} for c, s in zip(word, syllables)]
                 if jp and len(syllables) == len(word) else [])
        items.append({"word": word, "jyutping": jp, "meaning": "", "chars": chars})
    return json.dumps(items, ensure_ascii=False)


def stage_parse():
    with open(os.path.join(RAW, "charlist.json"), encoding="utf-8") as fh:
        chars = json.load(fh)
    word_map = {}
    idiom_set = set()
    phrase_set = set()
    char_readings = {}
    parsed = 0
    for cid, char in chars.items():
        path = os.path.join(RAW, f"char_{cid}.html")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            page = fh.read()
        readings, words, idioms, phrases = parse_page(page)
        if readings:
            char_readings[char] = readings
        for word, jp, ks in words:
            key = (word, jp)
            word_map.setdefault(key, {"ks1": False, "ks2": False})
            for k in ks:
                word_map[key][k] = True
        idiom_set.update(idioms)
        phrase_set.update(phrases)
        parsed += 1
    print(f"parsed {parsed} pages: {len(word_map)} word entries, "
          f"{len(idiom_set)} idioms, {len(phrase_set)} phrases", flush=True)

    with open(os.path.join(RAW, "char_readings_raw.json"), "w", encoding="utf-8") as fh:
        json.dump(char_readings, fh, ensure_ascii=False, indent=1)

    ks1 = sorted([(w, jp) for (w, jp), k in word_map.items() if k["ks1"]],
                 key=lambda x: (len(x[0]), x[0]))
    ks2 = sorted([(w, jp) for (w, jp), k in word_map.items() if k["ks2"]],
                 key=lambda x: (len(x[0]), x[0]))
    idioms = sorted(idiom_set)
    phrases = sorted(phrase_set)

    def write_csv(name, header, rows):
        with open(os.path.join(ROOT, name), "w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(header)
            writer.writerows(rows)

    write_csv("edb_ks1_words.csv", ["word", "jyutping"], ks1)
    write_csv("edb_ks2_words.csv", ["word", "jyutping"], ks2)
    write_csv("edb_idioms4.csv", ["word"], [(w,) for w in idioms])
    write_csv("edb_phrases.csv", ["word"], [(w,) for w in phrases])

    js = (
        "// 資料來源: 香港教育局《香港小學學習字詞表》 https://www.edbchinese.hk/lexlist_ch/\n"
        "// 粵拼: 香港語言學學會粵語拼音方案 (lshk); 四字詞語/多字熟語原站無注音\n"
        "const EDB_VOCAB = {\n"
        f'  "第一學習階段": {words_to_js(ks1)},\n'
        f'  "第二學習階段": {words_to_js(ks2)},\n'
        f'  "四字詞語": {words_to_js([(w, "") for w in idioms])},\n'
        f'  "多字熟語": {words_to_js([(w, "") for w in phrases])}\n'
        "};\n"
    )
    with open(os.path.join(ROOT, "edb-vocab.js"), "w", encoding="utf-8") as fh:
        fh.write(js)
    print("outputs written", flush=True)


def main():
    stage = sys.argv[1] if len(sys.argv) > 1 else "all"
    if stage in ("charlist", "all"):
        stage_charlist()
    if stage in ("details", "all"):
        stage_details()
    if stage in ("parse", "all"):
        stage_parse()


if __name__ == "__main__":
    main()

