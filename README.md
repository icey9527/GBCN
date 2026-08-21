# 女皇之刃 Wiki 镜像（日中对照版）

镜像 [Queen's Blade Wiki (Fandom)](https://queensblade.fandom.com/wiki/Queen%27s_Blade_Wiki)，
角色名按术语表显示为「日文名（中文名）」，原英文名保留作对照。

## 使用

双击 **`启动网站.bat`**（需要 Python），浏览器打开 <http://localhost:8420>。

## 目录结构

```
web/
├── index.html              # 网站入口（SPA，无构建步骤）
├── 启动网站.bat             # 一键启动本地服务
├── assets/
│   ├── css/style.css       # 全站样式
│   └── js/
│       ├── app.js          # 路由 / 渲染 / 搜索 / 链接图片重写
│       └── localize.js     # 名字替换引擎（文本节点级 EN→「JA（ZH）」）
├── data/                   # ★ 人工维护区 ★
│   ├── names.json          #   EN→JA→ZH 角色对照表（改这里即可增删角色）
│   └── glossary.json       #   术语表（由 tools/export_data.ps1 从翻译项目导出）
├── wiki_data/              # 自动生成区（脚本产物，勿手改）
│   ├── manifest.json       #   标题→文件名 映射
│   ├── index.json          #   标题→分类 索引（build_index.ps1 生成）
│   ├── images_map.json     #   远程图片URL→本地路径
│   ├── pages/NNNN.json     #   每篇文章的渲染后 HTML
│   └── images/             #   本地图片
└── tools/                  # PowerShell 工具脚本
    ├── download_wiki.ps1   #   全量下载 wiki（支持断点续传）
    ├── download_images.ps1 #   下载文章用到的图片（支持续传）
    ├── build_index.ps1     #   重建分类索引 index.json
    └── export_data.ps1     #   术语表 terms-*.json → data/glossary.json
```

## 日常维护

| 想做什么 | 怎么做 |
|---|---|
| 改角色的日中文名、加新角色 | 编辑 `data/names.json`，刷新页面即可 |
| wiki 内容更新了 | 依次跑 `download_wiki.ps1` → `download_images.ps1` → `build_index.ps1` |
| 术语表更新了 | 跑 `export_data.ps1`（改一下脚本里的源文件路径） |
| 文章里某个词替换得不合适 | 在 `names.json` 对应条目的 `variants` 里调整匹配词 |

## names.json 字段说明

```json
{
  "en":  "Leina",            // 英文写法（用于匹配 wiki 正文里的名字）
  "ja":  "レイナ",           // 日文名（显示用）
  "zh":  "蕾娜",             // 中文名（显示用）
  "page": "Leina",           // 对应的 wiki 页面标题（点卡片跳转用）
  "series": "女皇之刃",       // 分组（角色列表页按此分组）
  "variants": ["Leina Vance"] // 其他英文写法，也会被替换；长词优先匹配
}
```

替换规则：正文中出现 `en` / `variants` 里的词（整词匹配、忽略大小写）时，
替换为 `ja（zh）`。多个候选按**词长降序**匹配，避免 "Elina" 被 "Lina" 截胡。

## 注意

- 直接双击 `index.html` 无法加载 JSON（浏览器 file:// 限制），务必走 `启动网站.bat`。
- 镜像内容版权归原作者 Hobby Japan / Fandom Wiki 所有，仅供汉化项目内部参考。

## 已知限制

- **正文是英文原文**：wiki 只有英文版，站点做的是「角色名日中对照」——正文里出现的角色名
  会替换成 `日文名（中文名）`，其余叙述文字仍是英文。技能/物品等术语正文里不会自动翻译
  （术语表只在「术语表」页面浏览）。
- **16 个游戏原创角色没有 wiki 页面**（艾玛、艾米莉、萨莎、皇、塞蕾涅、普格尔、贝丝、
  玛姆、梅、拉尔、瑠那、慧梨、藏舞、山吹、薰子、阳子、ＢＪ 等，出自《女王之门：螺旋混沌》）：
  它们在角色列表里正常显示，但卡片不可点击（wiki 没收录）。
- 图片本地化是后台批量任务（`download_images.ps1`，1 万余张）：没下完之前页面用远程图
  兜底，脚本报错中断后重跑即可续传。
- 视频（Fandom 的 video file）无法离线，点击会跳到在线站。
