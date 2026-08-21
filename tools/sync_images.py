# -*- coding: utf-8 -*-
"""
sync_images.py - 图片整理：下载角色页图片 + 删除画廊独有图片
================================================
1. 扫描全部页面，把图片按页面类型分类（画廊 / 角色 / 其他）。
2. 下载「角色页」引用但本地缺失的图片到 wiki_data/images/，并更新 images_map.json。
3. 删除仅被画廊页引用的本地图片文件，并移除其映射条目。
4. 清理 images/ 下不被映射引用的孤儿文件。

用法:  python tools/sync_images.py
可重复运行（断点续传）：已下载的会跳过。
"""
import json, re, sys, os, io, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(ROOT, '..', 'wiki_data', 'pages')
IMG_DIR = os.path.join(ROOT, '..', 'wiki_data', 'images')
MAP_FILE = os.path.join(ROOT, '..', 'wiki_data', 'images_map.json')

SRC_RE = re.compile(r'<img[^>]*?\ssrc="([^"]+)"')
DSRC_RE = re.compile(r'<img[^>]*?\sdata-src="([^"]+)"')
WIDTH_RE = re.compile(r'/scale-to-width-down/(\d+)')


def page_imgs(html):
    """抓 src 和 data-src 两类地址"""
    srcs = [s for s in SRC_RE.findall(html) if not s.startswith('data:')]
    srcs += [s for s in DSRC_RE.findall(html) if not s.startswith('data:')]
    return srcs


def base_url(u):
    """去掉 /revision/latest 之后的缩放参数"""
    if '/revision/latest' in u:
        return u.split('/revision/latest')[0] + '/revision/latest'
    return u


def scan_pages():
    """返回 (char_variants, gal_bases, other_bases)
    char_variants: base_url -> 最佳下载 URL（取引用的最大缩放宽度）"""
    char_variants = {}
    gal_bases, other_bases = set(), set()
    for fn in sorted(os.listdir(PAGES)):
        if not fn.endswith('.json'):
            continue
        with io.open(os.path.join(PAGES, fn), 'r', encoding='utf-8-sig') as f:
            p = json.load(f)
        title = p.get('title', '')
        cats = p.get('categories', [])
        html = p.get('html', '')
        srcs = page_imgs(html)
        if '/Gallery' in title:
            gal_bases.update(base_url(s) for s in srcs)
        elif 'Characters' in cats:
            for s in srcs:
                b = base_url(s)
                w = WIDTH_RE.search(s)
                w = int(w.group(1)) if w else 99999
                if b not in char_variants or w > char_variants[b][1]:
                    char_variants[b] = (s, w)
        else:
            other_bases.update(base_url(s) for s in srcs)
    return char_variants, gal_bases, other_bases


def ext_of(url):
    path = url.split('/revision/latest')[0]
    ext = os.path.splitext(path)[1].lower()
    return ext if ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp') else '.jpg'


def download_one(args):
    b, url, dest = args
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if len(data) < 200:  # 过小视为失败（可能是错误页）
            return b, None, 'too small'
        with open(dest, 'wb') as f:
            f.write(data)
        return b, dest, None
    except Exception as e:
        return b, None, str(e)


def main():
    print('扫描页面...')
    char_variants, gal_bases, other_bases = scan_pages()
    keep_bases = set(char_variants) | other_bases
    gal_only = gal_bases - keep_bases
    print('角色页图片 %d 张 | 画廊独有 %d 张 | 其他页 %d 张' % (len(char_variants), len(gal_only), len(other_bases)))

    with io.open(MAP_FILE, 'r', encoding='utf-8-sig') as f:
        im = json.load(f)
    with io.open(MAP_FILE + '.bak', 'w', encoding='utf-8') as f:
        json.dump(im, f, ensure_ascii=False, indent=1)

    # ---------- 1. 下载角色页缺失图片 ----------
    todo = []
    for b, (url, w) in char_variants.items():
        if b in im:
            continue
        fname = hashlib.md5(b.encode('utf-8')).hexdigest().upper() + ext_of(b)
        dest = os.path.join(IMG_DIR, fname)
        if os.path.exists(dest) and os.path.getsize(dest) > 200:
            im[b] = 'images/' + fname
            continue
        todo.append((b, url, dest))
    print('角色页待下载: %d' % len(todo))
    ok = fail = 0
    if todo:
        with ThreadPoolExecutor(max_workers=8) as ex:
            futs = [ex.submit(download_one, t) for t in todo]
            for i, fut in enumerate(as_completed(futs), 1):
                b, dest, err = fut.result()
                if err:
                    fail += 1
                    print('  失败 %s (%s)' % (b[-60:], err))
                else:
                    ok += 1
                    im[b] = 'images/' + os.path.basename(dest)
                if i % 100 == 0:
                    print('  进度 %d/%d (成功 %d 失败 %d)' % (i, len(todo), ok, fail))
    print('下载完成: 成功 %d 失败 %d' % (ok, fail))

    # ---------- 2. 画廊独有图片：写删除清单（删除动作由外部执行） ----------
    del_list = []
    del_bytes = 0
    for b in list(im.keys()):
        if b in gal_only:
            local = im.pop(b)
            path = os.path.join(ROOT, '..', 'wiki_data', local)
            if os.path.exists(path):
                del_bytes += os.path.getsize(path)
                del_list.append(os.path.abspath(path))
    list_file = os.path.join(ROOT, '_im_delete_list.txt')
    with io.open(list_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(del_list))
    print('画廊独有图片: %d 个文件, %.1f MB -> 删除清单 %s' % (len(del_list), del_bytes / 1048576, list_file))

    # ---------- 3. 孤儿文件清单（画廊文件删完后这里应为空） ----------
    referenced = set(im.values())
    orphans = []
    for fn in os.listdir(IMG_DIR):
        rel = 'images/' + fn
        if rel not in referenced:
            p = os.path.abspath(os.path.join(IMG_DIR, fn))
            if p not in del_list:
                orphans.append(p)
    if orphans:
        with io.open(list_file, 'a', encoding='utf-8') as f:
            f.write('\n' + '\n'.join(orphans))
        print('孤儿文件: %d（已追加到删除清单）' % len(orphans))

    with io.open(MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(im, f, ensure_ascii=False, indent=1)
    print('images_map.json 更新: %d 条' % len(im))


if __name__ == '__main__':
    main()
