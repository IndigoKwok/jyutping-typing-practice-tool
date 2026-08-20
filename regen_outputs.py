# -*- coding: utf-8 -*-
"""離線重出《香港小學學習字詞表》全部表格 (raw/*.html -> CSV + edb-vocab.js)
v4: 類目改名 小學-*; 複雜注音 (①②/[..]/（兒）//) 取主讀音生成 chars, 保證打字工具可練可練習
執行: python regen_outputs.py
"""
import csv
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "raw")
LOOKUP_FILES = [
    r"C:\Users\Indigo\Documents\Codex\2026-08-18\https-jyutping-io-practice-https-jyutping\wordlist\chinese_only_entries.json",
    r"C:\Users\Indigo\Documents\Codex\2026-08-18\https-jyutping-io-practice-https-jyutping\wordlist\mixed_entries.json",
]

FUBIAO = [
    ("一", "小學-四字詞語", "edb_idioms4.csv", "word"),
    ("二", "小學-多字熟語", "edb_phrases.csv", "word"),
    ("三", "小學-文言詞語", "edb_classical.csv", "wordjp"),
    ("四", "小學-專名術語", "edb_proper_terms.csv", "wordjp"),
    ("五", "小學-音譯外來詞語", "edb_loanwords.csv", "wordeng"),
    ("六", "小學-人名地名用字", "edb_names.csv", "wordjp"),
]


def load_lookup():
    table = {}
    for path in LOOKUP_FILES:
        if not os.path.exists(path):
            print(f"lookup not found, skipped: {path}", flush=True)
            continue
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        for word, readings in data.items():
            if isinstance(readings, list) and readings:
                table.setdefault(word, readings[0])
    print(f"lookup entries: {len(table)}", flush=True)
    extra = os.path.join(ROOT, "edb_jyutping_extra.csv")
    if os.path.exists(extra):
        with open(extra, encoding="utf-8-sig") as fh:
            for row in csv.reader(fh):
                if len(row) >= 2 and row[0] != "word" and row[1]:
                    table.setdefault(row[0], row[1])
        print(f"with extra csv: {len(table)}", flush=True)
    return table


def strip_tags(text):
    text = re.sub(r"(?s)<script.*?</script>", "", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\ueb74", "\U00020C78").replace("\ue5a2", "哋")  # PUA -> 正規 Unicode
    return re.sub(r"\s+", " ", text).strip()


CJK_RE = re.compile(r"[㐀-鿿豈-﫿-﫿𠀀-𪛟]")
JP_RE = re.compile(r"^[a-z]+[1-6]$")


def primary_jyutping(jp):
    """取第一義項為主讀音; 去 [變讀] (可選音) 與 /并列"""
    parts = re.split(r"[①②③④⑤⑥⑦⑧⑨]", jp)
    s = parts[1] if len(parts) > 1 and not parts[0].strip() else parts[0]
    s = re.sub(r"\[[^\]]*\]", "", s)
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.split("/")[0].replace(";", " ")
    return " ".join(s.split())


def make_chars(word, jp):
    """逐字注音; 標點/字母等非漢字格 jp=None (與 SENTENCE_BANK 慣例一致)
       含拉丁字母的詞 (卡拉OK/T恤衫) 先試等長逐位對齊, 再退回到純漢字對齊"""
    base = re.sub(r"（[^）]*）", "", word)
    tokens = primary_jyutping(jp).split()
    if tokens and len(tokens) == len(base):
        return [{"c": c, "jp": t if (CJK_RE.match(c) and JP_RE.match(t)) else None}
                for c, t in zip(base, tokens)]
    syll = [t for t in tokens if JP_RE.match(t)]
    cjk = [c for c in base if CJK_RE.match(c)]
    if len(cjk) == 1 and len(syll) > 1:
        syll = syll[:1]
    if not syll or len(syll) != len(cjk):
        return []
    out, i = [], 0
    for c in base:
        if CJK_RE.match(c):
            out.append({"c": c, "jp": syll[i]})
            i += 1
        else:
            out.append({"c": c, "jp": None})
    return out


def parse_tblci(page):
    words = []
    tbl = re.search(r'(?s)id="tblCi".*?</table>', page)
    if not tbl:
        return words
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
    return words


def parse_fubiao(page):
    """六張附表: {序號: [(詞, 副欄)]}; 副欄=粵拼 或 英文原詞, 無則空串"""
    marks = [(m.start(), m.group(1)) for m in re.finditer(r"附表([一二三四五六])", page)]
    result = {}
    kind_of = {n: k for n, _, _, k in FUBIAO}
    for idx, (pos, num) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(page)
        footer = page.find('class="footer"', pos)
        if 0 <= footer < end:
            end = footer
        seg = page[pos:end]
        kind = kind_of[num]
        items = result.setdefault(num, [])
        if kind == "wordeng":
            word_cells = [strip_tags(c) for c in
                          re.findall(r'(?s)<td[^>]*class="ci"[^>]*>(.*?)</td>', seg)]
            eng_cells = [strip_tags(c) for c in
                         re.findall(r'(?s)<td[^>]*class="eng"[^>]*>(.*?)</td>', seg)]
            for w, e in zip(word_cells, eng_cells):
                if w:
                    items.append((w, e))
        else:
            for row in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", seg):
                cells = re.findall(r'(?s)<td[^>]*class="ci"[^>]*>(.*?)</td>', row)
                if not cells:
                    continue
                jp_m = re.search(r'(?s)class="jyutping\w*"[^>]*>(.*?)</div>', row)
                if jp_m:
                    w = strip_tags(cells[0])
                    if w and re.search(r"[一-鿿]", w):
                        items.append((w, strip_tags(jp_m.group(1))))
                else:
                    for cell in cells:
                        w = strip_tags(cell)
                        if w and re.search(r"[一-鿿]", w):
                            items.append((w, ""))
    return result


def words_to_js(entries):
    """entries: [(word, jp)]"""
    items = []
    for word, jp in entries:
        items.append({"word": word, "jyutping": jp, "meaning": "",
                      "chars": make_chars(word, jp)})
    return json.dumps(items, ensure_ascii=False)


def words_eng_to_js(entries):
    """entries: [(word, english, jp)]"""
    items = []
    for word, eng, jp in entries:
        items.append({"word": word, "jyutping": jp, "meaning": eng,
                      "chars": make_chars(word, jp)})
    return json.dumps(items, ensure_ascii=False)


def main():
    lookup = load_lookup()
    with open(os.path.join(RAW, "charlist.json"), encoding="utf-8") as fh:
        chars = json.load(fh)
    word_map = {}
    fubiao_sets = {num: {} for num, _, _, _ in FUBIAO}
    parsed = 0
    for cid in sorted(chars, key=lambda x: int(x)):
        path = os.path.join(RAW, f"char_{cid}.html")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            page = fh.read()
        for word, jp, ks in parse_tblci(page):
            key = (word, jp)
            word_map.setdefault(key, {"ks1": False, "ks2": False})
            for k in ks:
                word_map[key][k] = True
        for num, items in parse_fubiao(page).items():
            for w, aux in items:
                cur = fubiao_sets[num].get(w)
                if cur is None or (not cur and aux):
                    fubiao_sets[num][w] = aux
        parsed += 1

    ks1 = sorted([(w, jp) for (w, jp), k in word_map.items() if k["ks1"]],
                 key=lambda x: (len(x[0]), x[0]))
    ks2 = sorted([(w, jp) for (w, jp), k in word_map.items() if k["ks2"]],
                 key=lambda x: (len(x[0]), x[0]))

    def write_csv(name, header, rows):
        with open(os.path.join(ROOT, name), "w", encoding="utf-8-sig", newline="") as fh:
            csv.writer(fh).writerows([header] + rows)

    write_csv("edb_ks1_words.csv", ["word", "jyutping"], ks1)
    write_csv("edb_ks2_words.csv", ["word", "jyutping"], ks2)

    js_parts = [
        "// 資料來源: 香港教育局《香港小學學習字詞表》 https://www.edbchinese.hk/lexlist_ch/",
        "// 粵拼: LSHK; 附表一/二/五 粵拼由本地 wordlist lookup + to-jyutping 轉換補上",
        "// chars 為主讀音逐字注音 (複雜注音取第一義項); jyutping 保留原站完整標記",
        "const EDB_VOCAB = {",
        '  "小學-KS1": ' + words_to_js(ks1) + ",",
        '  "小學-KS2": ' + words_to_js(ks2) + ",",
    ]
    report = [f"parsed {parsed} pages", f"KS1 {len(ks1)}  KS2 {len(ks2)}"]
    unmatched_all = []
    chars_empty = 0
    for idx, (num, title, fname, kind) in enumerate(FUBIAO):
        rows = sorted(fubiao_sets[num].items(), key=lambda x: (len(x[0]), x[0]))
        if kind == "wordeng":
            filled = [(w, eng, lookup.get(w, "")) for w, eng in rows]
            write_csv(fname, ["word", "english", "jyutping"],
                      [[w, eng, jp] for w, eng, jp in filled])
            body = words_eng_to_js(filled)
            hit = sum(1 for _, _, jp in filled if jp)
            unmatched = [w for w, _, jp in filled if not jp]
            chars_empty += sum(1 for w, _, jp in filled if not make_chars(w, jp))
        else:
            filled = [(w, aux or lookup.get(w, "")) for w, aux in rows]
            write_csv(fname, ["word", "jyutping"], [list(r) for r in filled])
            body = words_to_js(filled)
            hit = sum(1 for _, jp in filled if jp)
            unmatched = [w for w, jp in filled if not jp]
            chars_empty += sum(1 for w, jp in filled if not make_chars(w, jp))
        js_parts.append(f'  "{title}": {body}' + ("," if idx < len(FUBIAO) - 1 else ""))
        report.append(f"附表{num} {title}: {len(filled)} (有粵拼 {hit})")
        unmatched_all.extend(unmatched)
    chars_empty += sum(1 for w, jp in ks1 + ks2 if not make_chars(w, jp))
    js_parts.append("};\n")
    with open(os.path.join(ROOT, "edb-vocab.js"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(js_parts))
    with open(os.path.join(ROOT, "edb_unmatched.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(unmatched_all) + ("\n" if unmatched_all else ""))
    report.append(f"lookup 後仍無粵拼: {len(unmatched_all)} -> edb_unmatched.txt")
    report.append(f"chars 為空的條目: {chars_empty}")
    print("\n".join(report), flush=True)


if __name__ == "__main__":
    main()


