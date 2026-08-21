# -*- coding: utf-8 -*-
"""
tl_pipeline.py - wiki 页面文本提取 / 回写
================================================
从 wiki_data/pages/*.json 的 html 字段里提取所有可见英文文本，
写成 {"原文": "译文"} 的 JSON 字典；你用外部工具翻译后，再用本脚本写回。

用法:
  python tl_pipeline.py extract
      遍历全部页面，提取文本（去重），输出:
        wiki_data/translations.json   <- 字典 {"原文": "原文"}，翻译时只改右边的值
      （内部位置信息存在 tools/_tl_pieces.json，勿手改）

  python tl_pipeline.py apply
      读取 wiki_data/translations.json，把译文写回 wiki_data/pages/*.json
      - 值与键相同（没翻译的条目）→ 保持原样，不动
      - 回写前校验原文是否还在原位置，不一致的条目会跳过并列出
      - 译文中的 & < > 会自动转义，不会破坏 HTML

说明:
- 只提取标签之间的可见文本（含英文字母），不碰 href/class/style 等属性。
- script/style/注释 里的内容不会被提取。
- 页面文件带 BOM(utf-8-sig)，回写保持 BOM + 4 空格缩进。
"""
import json, re, sys, os, io
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(ROOT, '..', 'wiki_data', 'pages')
DICT_OUT = os.path.join(ROOT, '..', 'wiki_data', 'translations.json')
PIECES = os.path.join(ROOT, '_tl_pieces.json')

TAG_RE = re.compile(r'(<[^>]+>)')
MASK_RE = re.compile(r'<!--.*?-->|<script[^>]*>.*?</script>|<style[^>]*>.*?</style>', re.S)
ENTITY_RE = re.compile(r'&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;')


def mask_blocks(html):
    """注释/script/style -> 等长空格，保持偏移一致"""
    return MASK_RE.sub(lambda m: ' ' * (m.end() - m.start()), html)


def entity_to_char(m):
    e = m.group(0)
    if e.startswith('&#x') or e.startswith('&#X'):
        try: return chr(int(e[3:-1], 16))
        except Exception: return ' '
    if e.startswith('&#'):
        try: return chr(int(e[2:-1]))
        except Exception: return ' '
    return {'&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
            '&quot;': '"', '&#39;': "'", '&apos;': "'", '&mdash;': '—',
            '&ndash;': '–', '&rsquo;': '\u2019', '&lsquo;': '\u2018',
            '&ldquo;': '\u201c', '&rdquo;': '\u201d', '&hellip;': '…'}.get(e, ' ')


def html_to_text(s):
    return ENTITY_RE.sub(entity_to_char, s)


def extract_page(html):
    """返回 [(start, end, text, lead, trail)] — text 为可见文本（实体已转换）"""
    masked = mask_blocks(html)
    pieces = []
    pos = 0
    for m in TAG_RE.finditer(masked):
        text = masked[pos:m.start()]
        run_start = pos
        pos = m.end()
        if not text:
            continue
        stripped = text.strip(' \t\r\n ')
        if not stripped or not re.search(r'[A-Za-z]', stripped):
            continue
        visible = html_to_text(stripped)
        lead = text[:len(text) - len(text.lstrip(' \t\r\n '))]
        trail = text[len(text.rstrip(' \t\r\n ')):]
        start = run_start + text.find(stripped)
        pieces.append((start, start + len(stripped), visible, lead, trail))
    return pieces


def extract():
    result = {}
    texts = Counter()
    for fn in sorted(os.listdir(PAGES)):
        if not fn.endswith('.json'):
            continue
        with io.open(os.path.join(PAGES, fn), 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        pieces = []
        for (start, end, text, lead, trail) in extract_page(data.get('html', '')):
            pieces.append({'start': start, 'end': end, 'text': text,
                           'lead': lead, 'trail': trail})
            texts[text] += 1
        result[fn] = pieces
    with io.open(PIECES, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    d = {t: t for t, _ in texts.most_common()}
    with io.open(DICT_OUT, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print('提取完成: %d 个页面, %d 个文本片段, %d 条唯一文本' % (len(result), sum(len(v) for v in result.values()), len(d)))
    print('字典 -> %s' % DICT_OUT)
    print('位置信息 -> %s (勿手改)' % PIECES)


def apply():
    with io.open(PIECES, 'r', encoding='utf-8') as f:
        pieces_map = json.load(f)
    with io.open(DICT_OUT, 'r', encoding='utf-8') as f:
        tr = json.load(f)
    done = skip = 0
    for fn, pieces in pieces_map.items():
        path = os.path.join(PAGES, fn)
        with io.open(path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        html = data.get('html', '')
        edits = []
        for p in pieces:
            zh = tr.get(p['text'])
            if not zh or zh == p['text']:
                continue  # 未翻译的条目保持原样
            cur = html[p['start']:p['end']]
            if html_to_text(cur) != p['text']:
                print('  跳过(原文已变) %s [%s]' % (fn, p['text'][:40]))
                skip += 1
                continue
            zh_safe = zh.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            edits.append((p['start'], p['end'], p['lead'] + zh_safe + p['trail']))
        if not edits:
            continue
        for start, end, new in sorted(edits, reverse=True):
            html = html[:start] + new + html[end:]
        data['html'] = html
        with io.open(path, 'w', encoding='utf-8-sig') as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=4))
        done += 1
    print('回写完成: %d 个页面被更新, %d 个片段被跳过' % (done, skip))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'extract':
        extract()
    elif cmd == 'apply':
        apply()
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
