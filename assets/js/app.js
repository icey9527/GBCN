/* ============================================================
 * app.js - 主逻辑：路由 / 渲染 / 搜索 / 链接与图片重写
 * 数据来源（均由 tools/ 下脚本生成，无需构建步骤）：
 *   wiki_data/manifest.json   标题 -> 文件
 *   wiki_data/index.json      标题 -> {categories}
 *   wiki_data/images_map.json 远程图片URL -> 本地路径
 *   data/names.json           EN->JA->ZH 角色对照表（手工维护）
 *   data/glossary.json        日->中 术语表
 * ============================================================ */
(function () {
  'use strict';

  const main = document.getElementById('main');
  const categoryList = document.getElementById('category-list');

  const state = {
    manifest: [],        // [{index,title,file}]
    titleToFile: new Map(),
    index: new Map(),    // title -> categories[]
    imagesMap: {},       // remote url -> local path
    loadedPages: new Map() // title -> page json
  };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function setLoading() { main.innerHTML = '<div class="loading">加载中…</div>'; }

  async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
    return r.json();
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    setLoading();
    try {
      const [manifest, names, glossary, imagesMap] = await Promise.all([
        fetchJson('wiki_data/manifest.json'),
        fetchJson('data/names.json'),
        fetchJson('data/glossary.json').catch(() => []),
        fetchJson('wiki_data/images_map.json').catch(() => ({}))
      ]);
      state.manifest = manifest;
      for (const m of manifest) state.titleToFile.set(m.title, m.file);
      state.imagesMap = imagesMap;
      window.GLOSSARY = glossary;
      Localize.load(names);

      // index.json 可选（build_index.ps1 生成）；没有就从已加载页面积累
      try {
        const idx = await fetchJson('wiki_data/index.json');
        for (const it of idx) state.index.set(it.title, it.categories || []);
      } catch (e) { /* ignore */ }

      renderCategories();
      window.addEventListener('hashchange', route);
      route();
    } catch (err) {
      main.innerHTML = '<div class="loading">加载失败：' + esc(err.message) +
        '<br><br>请确认通过本地 HTTP 服务打开（双击「启动网站.bat」），不要直接双击 index.html。</div>';
    }
  }

  /* ---------- 侧栏分类 ---------- */
  const MAIN_CATS = ['Characters', 'Books', 'Games', 'Anime', 'Locations', 'Items', 'Events'];
  function renderCategories() {
    const counts = new Map();
    for (const cats of state.index.values()) {
      for (const c of cats) counts.set(c, (counts.get(c) || 0) + 1);
    }
    const items = [...counts.entries()]
      .filter(([c, n]) => n >= 3 && !/^Pages_/i.test(c))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);
    if (!items.length) { categoryList.innerHTML = '<li><small>分类索引待生成</small></li>'; return; }
    categoryList.innerHTML = items.map(([c, n]) =>
      '<li><a href="#/category/' + encodeURIComponent(c) + '">' + esc(c).replace(/_/g, ' ') + ' (' + n + ')</a></li>'
    ).join('');
  }

  /* ---------- 路由 ---------- */
  function route() {
    const raw = (location.hash || '#/').replace(/^#\//, '');
    const qIdx = raw.indexOf('?');
    const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const queryPart = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
    const parts = pathPart.split('/').map(decodeURIComponent);
    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    setLoading();
    window.scrollTo(0, 0);

    if (parts[0] === '' ) return renderHome();
    if (parts[0] === 'page') return renderPage(parts.slice(1).join('/'));
    if (parts[0] === 'characters') { setActive('characters'); return renderCharacters(); }
    if (parts[0] === 'glossary') { setActive('glossary'); return renderGlossary(); }
    if (parts[0] === 'pages') { setActive('pages'); return renderAllPages(); }
    if (parts[0] === 'category') return renderCategory(parts[1] || '');
    if (parts[0] === 'search') return renderSearch(new URLSearchParams(queryPart).get('q') || '');
    renderHome();
  }
  function setActive(key) {
    const a = document.querySelector('.main-nav a[href="#/' + key + '"]');
    if (a) a.classList.add('active');
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    const e = Localize.find('Leina') || Localize.entries[0];
    const demo = e ? Localize.display(e) : 'レイナ（蕾娜）';
    const nChars = Localize.entries.length;
    main.innerHTML = `
      <div class="hero">
        <h1>クイーンズブレイド / 女皇之刃</h1>
        <p>Queen's Blade Wiki 离线镜像 · 角色名日中对照版</p>
        <p class="name-demo">角色名显示示例：<span class="ja">${esc(demo)}</span></p>
      </div>
      <h2 class="section-title">快速入口</h2>
      <div class="char-grid">
        <a class="char-card" href="#/characters"><span class="ja">角色一覧</span><span class="zh">角色列表（${nChars}）</span><span class="en">Characters</span></a>
        <a class="char-card" href="#/glossary"><span class="ja">用語集</span><span class="zh">术语表</span><span class="en">Glossary</span></a>
        <a class="char-card" href="#/pages"><span class="ja">全ページ</span><span class="zh">全部页面（${state.manifest.length}）</span><span class="en">All Pages</span></a>
      </div>
      <h2 class="section-title">主要角色</h2>
      <div class="char-grid" id="home-chars"></div>`;
    const grid = document.getElementById('home-chars');
    const featured = ['Leina', 'Tomoe', 'Airi', 'Melona', 'Menace', 'Echidna', 'Nanael', 'Aldra']
      .map(n => Localize.find(n)).filter(Boolean);
    grid.innerHTML = featured.map(charCard).join('') || '<p>names.json 为空</p>';
  }

  /* ---------- 角色页 ---------- */
  function charCard(e) {
    const inner =
      '<span class="ja">' + esc(e.ja) + '</span>' +
      '<span class="zh">' + esc(e.zh || '') + '</span>' +
      '<span class="en">' + esc(e.en || '') + '</span>';
    if (e.page) return '<a class="char-card" href="#/page/' + encodeURIComponent(e.page) + '">' + inner + '</a>';
    return '<div class="char-card" title="该角色暂无 Wiki 页面">' + inner + '</div>';
  }

  function renderCharacters() {
    const groups = new Map();
    for (const e of Localize.entries) {
      const s = e.series || '其他';
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s).push(e);
    }
    let html = '<h2 class="section-title">角色一覧 / 角色列表</h2>';
    for (const [series, list] of groups) {
      list.sort((a, b) => a.ja.localeCompare(b.ja, 'ja'));
      html += '<div class="series-group"><h3>' + esc(series) + '（' + list.length + '）</h3><div class="char-grid">' +
        list.map(charCard).join('') + '</div></div>';
    }
    main.innerHTML = html;
  }

  /* ---------- 术语表页 ---------- */
  function renderGlossary() {
    const g = window.GLOSSARY || [];
    if (!g.length) { main.innerHTML = '<h2 class="section-title">术语表</h2><p>data/glossary.json 未生成。</p>'; return; }
    const cats = [...new Set(g.map(x => x.note || '其他'))];
    main.innerHTML = '<h2 class="section-title">用語集 / 术语表（' + g.length + ' 条）</h2>' +
      '<div class="glossary-controls" id="g-controls">' +
      '<button class="active" data-cat="">全部</button>' +
      cats.map(c => '<button data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '</div><div id="g-body"></div>';
    const body = document.getElementById('g-body');
    function draw(cat) {
      const rows = g.filter(x => !cat || (x.note || '其他') === cat)
        .sort((a, b) => a.term.localeCompare(b.term, 'ja'));
      body.innerHTML = '<table class="glossary-table"><thead><tr><th>日文</th><th>中文</th><th>分类</th></tr></thead><tbody>' +
        rows.map(x => '<tr><td>' + esc(x.term) + '</td><td>' + esc(x.translation) + '</td><td>' + esc(x.note || '') + '</td></tr>').join('') +
        '</tbody></table>';
    }
    document.getElementById('g-controls').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      document.querySelectorAll('#g-controls button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      draw(b.dataset.cat);
    });
    draw('');
  }

  /* ---------- 全部页面 ---------- */
  function renderAllPages() {
    const titles = state.manifest.map(m => m.title).sort((a, b) => a.localeCompare(b));
    main.innerHTML = '<h2 class="section-title">全ページ / 全部页面（' + titles.length + '）</h2>' +
      '<div class="list-page"><ul>' + titles.map(t => {
        const e = Localize.findByPage(t);
        const label = e ? esc(Localize.display(e)) + ' <small style="color:var(--text-dim)">' + esc(t) + '</small>' : esc(t);
        return '<li><a href="#/page/' + encodeURIComponent(t) + '">' + label + '</a></li>';
      }).join('') + '</ul></div>';
  }

  /* ---------- 分类页 ---------- */
  function renderCategory(cat) {
    const titles = [...state.index.entries()].filter(([, cs]) => cs.includes(cat)).map(([t]) => t).sort();
    main.innerHTML = '<div class="breadcrumb"><a href="#/">首页</a> › 分类</div>' +
      '<h2 class="section-title">分类：' + esc(cat) + '（' + titles.length + '）</h2>' +
      (titles.length
        ? '<div class="list-page"><ul>' + titles.map(t => {
            const e = Localize.findByPage(t);
            const label = e ? esc(Localize.display(e)) + ' <small style="color:var(--text-dim)">' + esc(t) + '</small>' : esc(t);
            return '<li><a href="#/page/' + encodeURIComponent(t) + '">' + label + '</a></li>';
          }).join('') + '</ul></div>'
        : '<p>该分类下没有已索引的页面。</p>');
  }

  /* ---------- 搜索 ---------- */
  function renderSearch(q) {
    if (!q) { main.innerHTML = '<h2 class="section-title">搜索</h2><p>输入关键词。</p>'; return; }
    const ql = q.toLowerCase();
    const hits = [];
    // 先匹配角色（ja/zh/en）
    for (const e of Localize.entries) {
      if ((e.ja && e.ja.includes(q)) || (e.zh && e.zh.includes(q)) ||
          (e.en && e.en.toLowerCase().includes(ql))) {
        hits.push({ title: e.page || e.en, name: Localize.display(e), meta: '角色 · ' + (e.series || '') });
      }
    }
    // 再匹配页面标题
    for (const m of state.manifest) {
      if (m.title.toLowerCase().includes(ql) && !hits.some(h => h.title === m.title)) {
        const e = Localize.findByPage(m.title);
        hits.push({ title: m.title, name: e ? Localize.display(e) : m.title, meta: '页面' });
      }
    }
    main.innerHTML = '<h2 class="section-title">搜索“' + esc(q) + '”（' + hits.length + ' 条结果）</h2>' +
      (hits.length ? hits.slice(0, 100).map(h =>
        '<div class="search-result"><div class="r-title"><a href="#/page/' + encodeURIComponent(h.title) + '">' +
        '<span class="zh">' + esc(h.name) + '</span> <small style="color:var(--text-dim)">' + esc(h.title) + '</small></a></div>' +
        '<div class="r-meta">' + esc(h.meta) + '</div></div>'
      ).join('') : '<p>没有找到结果。</p>');
  }
  document.getElementById('search-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const q = document.getElementById('search-input').value.trim();
    if (q) location.hash = '#/search?q=' + encodeURIComponent(q);
  });

  /* ---------- 文章页 ---------- */
  async function renderPage(title) {
    try {
      const page = await getPage(title);
      if (!page) {
        main.innerHTML = '<h2 class="section-title">页面不存在</h2><p>本地镜像中没有「' + esc(title) + '」。</p>' +
          '<p><a href="https://queensblade.fandom.com/wiki/' + encodeURIComponent(title) + '" target="_blank" rel="noopener">去在线 Wiki 查看 →</a></p>';
        return;
      }

      const doc = new DOMParser().parseFromString('<div id="root">' + page.html + '</div>', 'text/html');
      const root = doc.getElementById('root');
      rewriteImages(root);
      rewriteLinks(root);
      // 画廊页不展示图片（图片文件已从本地移除以节省空间）
      if ((page.title || '').indexOf('/Gallery') >= 0) {
        root.querySelectorAll('figure, picture, img').forEach(n => n.remove());
      }
      Localize.replaceInDom(root);

      const e = Localize.findByPage(page.title);
      const headerHtml =
        '<div class="article-header">' +
        (e ? '<h1 class="page-ja-zh">' + esc(e.ja) + ' <span class="zh">' + esc(e.zh || '') + '</span></h1>' +
             '<div class="page-en">EN: ' + esc(page.title) + ' / JA: ' + esc(e.ja) + ' / ZH: ' + esc(e.zh || '') + '</div>'
           : '<h1 class="page-ja-zh" style="color:var(--text)">' + (page.displaytitle || esc(page.title)) + '</h1>') +
        '</div>';

      const crumbLabel = e ? esc(Localize.display(e)) + ' <small style="color:var(--text-dim)">' + esc(page.title) + '</small>' : esc(page.title);
      main.innerHTML = '<div class="breadcrumb"><a href="#/">首页</a> › ' + crumbLabel + '</div>' +
        headerHtml + '<div class="wiki-content" id="wiki-body"></div>';
      document.getElementById('wiki-body').appendChild(root);

      if (!state.index.has(page.title)) {
        state.index.set(page.title, page.categories || []);
        renderCategories();
      }
    } catch (err) {
      main.innerHTML = '<div class="loading">页面加载失败：' + esc(err.message) + '</div>';
    }
  }

  async function getPage(title) {
    if (state.loadedPages.has(title)) return state.loadedPages.get(title);
    // 精确匹配，其次大小写不敏感匹配
    let file = state.titleToFile.get(title);
    if (!file) {
      const tl = title.toLowerCase();
      for (const [t, f] of state.titleToFile) {
        if (t.toLowerCase() === tl) { file = f; title = t; break; }
      }
    }
    if (!file) return null;
    const page = await fetchJson('wiki_data/pages/' + file);
    state.loadedPages.set(title, page);
    return page;
  }

  /* 把远程图片地址换成本地路径（images_map.json），失败则保留远程 */
  function lookupImage(src) {
    // 精确匹配，其次按 /revision/latest 之前的基地址匹配（忽略缩放参数）
    let local = state.imagesMap[src];
    if (local) return local;
    const idx = src.indexOf('/revision/latest');
    if (idx >= 0) {
      local = state.imagesMap[src.slice(0, idx + '/revision/latest'.length)];
      if (local) return local;
    }
    return null;
  }
  function rewriteImages(root) {
    root.querySelectorAll('img').forEach(img => {
      img.removeAttribute('srcset');
      let src = img.getAttribute('src');
      const dataSrc = img.getAttribute('data-src');
      // Fandom 懒加载占位图（src 是 1x1 base64 gif），真实地址在 data-src
      if ((!src || src.startsWith('data:')) && dataSrc) src = dataSrc;
      if (!src || src.startsWith('data:')) return;
      const local = lookupImage(src);
      if (local) img.src = 'wiki_data/' + local;
      img.loading = 'lazy';
      img.removeAttribute('data-src');
    });
  }

  /* 站内 /wiki/ 链接改写为本地路由；不在镜像里的指向在线站 */
  function rewriteLinks(root) {
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith('/wiki/')) {
        const clean = href.replace(/^\/wiki\//, '').replace(/_/g, ' ');
        const hashIdx = clean.indexOf('#');
        const frag = hashIdx >= 0 ? clean.slice(hashIdx) : '';
        const raw = hashIdx >= 0 ? clean.slice(0, hashIdx) : clean;
        let t;
        try { t = decodeURIComponent(raw); } catch (e) { t = raw; }
        let target = null;
        if (state.titleToFile.has(t)) target = t;
        else {
          const tl = t.toLowerCase();
          for (const k of state.titleToFile.keys()) {
            if (k.toLowerCase() === tl) { target = k; break; }
          }
        }
        if (target) {
          a.href = '#/page/' + encodeURIComponent(target) + frag;
        } else {
          a.href = 'https://queensblade.fandom.com' + href;
          a.target = '_blank'; a.rel = 'noopener';
        }
      } else if (href.startsWith('//') || href.startsWith('http')) {
        if (!href.includes('localhost') && !href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener'; }
      } else if (href.startsWith('/')) {
        // 编辑、分类特殊页等：指回在线站
        a.href = 'https://queensblade.fandom.com' + href;
        a.target = '_blank'; a.rel = 'noopener';
      }
    });
    // 移除编辑按钮等噪音
    root.querySelectorAll('.mw-editsection, script, style, .printfooter').forEach(n => n.remove());
  }

  init();
})();
