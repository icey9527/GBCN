/* ============================================================
 * localize.js - 名字本地化引擎
 * 把页面里的英文角色名替换为「日文名（中文名）」同时显示。
 * 数据来自 data/names.json（EN→JA→ZH 对照表，可手工维护）。
 * ============================================================ */
(function (global) {
  'use strict';

  /** 转义正则特殊字符 */
  function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const Localize = {
    /** 所有条目：[{en, ja, zh, page, series, variants[], ci?}] */
    entries: [],
    /** en(含variants，按书写原样) -> entry */
    byEn: new Map(),
    /** en(含variants，小写) -> entry */
    byEnLower: new Map(),
    /** 页面标题 -> entry */
    byPage: new Map(),

    load(entries) {
      this.entries = entries || [];
      this.byEn = new Map();
      this.byEnLower = new Map();
      this.byPage = new Map();
      for (const e of this.entries) {
        const keys = [e.en].concat(e.variants || []);
        for (const k of keys) {
          if (!k) continue;
          if (!this.byEn.has(k)) this.byEn.set(k, e);
          const kl = k.toLowerCase();
          if (!this.byEnLower.has(kl)) this.byEnLower.set(kl, e);
        }
        // 页面别名：page、en、variants 都能当页面标题查
        // （wiki 重定向会把 "Leina" 变成 "Leina Vance"）
        for (const k of keys.concat(e.page ? [e.page] : [])) {
          if (k && !this.byPage.has(k)) this.byPage.set(k, e);
        }
      }
    },

    /** 组装显示名：日文名（中文名） */
    display(e) {
      if (!e) return '';
      return e.ja + (e.zh ? '（' + e.zh + '）' : '');
    },

    /** 按英文查条目（默认忽略大小写） */
    find(en) {
      return en ? this.byEnLower.get(en.toLowerCase()) || null : null;
    },

    /** 按页面标题查条目 */
    findByPage(title) {
      return this.byPage.get(title) || null;
    },

    /** 构建匹配词表：{cs:[{k,e}], ci:[{k,e}]}，各自按长度降序 */
    _buildWords() {
      const cs = [], ci = [];
      for (const e of this.entries) {
        const keys = [e.en].concat(e.variants || []);
        for (const k of keys) {
          if (!k || k.length < 2) continue;
          (e.ci ? ci : cs).push({ k, e });
        }
      }
      cs.sort((a, b) => b.k.length - a.k.length);
      ci.sort((a, b) => b.k.length - a.k.length);
      return { cs, ci };
    },

    _replaceFn(lowerMap) {
      return m => {
        const e = lowerMap.get(m.toLowerCase());
        return e ? e.ja + (e.zh ? '（' + e.zh + '）' : '') : m;
      };
    },

    /**
     * 对整段 HTML 字符串做文本级替换（只动标签之间的文本）。
     * 默认区分大小写（"Cute" 是角色名，"cute" 是形容词），
     * 条目加 "ci": true 可忽略大小写。长词优先，防止 Elina 被 Lina 抢先。
     */
    replaceInHtml(html) {
      if (!this.entries.length) return html;
      const { cs, ci } = this._buildWords();
      const patterns = [];
      if (cs.length) patterns.push({ re: new RegExp('\\b(' + cs.map(w => escRe(w.k)).join('|') + ')\\b', 'g'), map: this.byEn });
      if (ci.length) patterns.push({ re: new RegExp('\\b(' + ci.map(w => escRe(w.k)).join('|') + ')\\b', 'gi'), map: this.byEnLower });

      return html.replace(/>([^<]+)</g, function (whole, text) {
        let out = text;
        for (const p of patterns) out = out.replace(p.re, m => {
          const e = p.map.get(m) || p.map.get(m.toLowerCase());
          if (!e) return m;
          return e.ja + (e.zh ? '（' + e.zh + '）' : '');
        });
        return '>' + out + '<';
      });
    },

    /**
     * 对 DOM 树内的文本节点做替换（比正则更稳，用于已解析的文档）。
     */
    replaceInDom(root) {
      if (!this.entries.length || !root) return;
      const { cs, ci } = this._buildWords();
      const patterns = [];
      if (cs.length) patterns.push({ re: new RegExp('\\b(' + cs.map(w => escRe(w.k)).join('|') + ')\\b', 'g'), map: this.byEn });
      if (ci.length) patterns.push({ re: new RegExp('\\b(' + ci.map(w => escRe(w.k)).join('|') + ')\\b', 'gi'), map: this.byEnLower });

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentNode;
          if (!p || /^(SCRIPT|STYLE)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        let touched = false;
        for (const p of patterns) {
          p.re.lastIndex = 0;
          if (p.re.test(n.nodeValue)) { touched = true; break; }
        }
        if (!touched) continue;
        for (const p of patterns) {
          p.re.lastIndex = 0;
          n.nodeValue = n.nodeValue.replace(p.re, m => {
            const e = p.map.get(m) || p.map.get(m.toLowerCase());
            return e ? e.ja + (e.zh ? '（' + e.zh + '）' : '') : m;
          });
        }
      }
    }
  };

  global.Localize = Localize;
})(window);
