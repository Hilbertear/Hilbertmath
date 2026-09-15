"""Build a progressively enhanced directory from the site's own content.

Article metadata has one source of truth: each Markdown file's front matter.
The PDF descriptors below mirror the existing PDE and geometry resource pages;
unknown dates stay unknown, and file sizes come from the actual files.
"""

from __future__ import annotations

from datetime import date
from html import escape
import json
import re

from mkdocs.exceptions import PluginError
from mkdocs.utils import get_relative_url
from mkdocs.utils.meta import get_data


PDF_NOTES = (
    {
        "path": "elliptic-pde/harmonic-poly.pdf",
        "id": "pdf-harmonic-polynomials",
        "title": "调和多项式及其应用",
        "summary": "从复变函数中的一个结论出发，整理调和多项式的性质与应用。",
        "topics": ["偏微分方程", "调和分析"],
        "kind": "课程论文", "pages": 12,
    },
    {
        "path": "elliptic-pde/fall-seminar.pdf",
        "id": "pdf-elliptic-pde-perron",
        "title": "二阶椭圆 PDE：前三章与 Perron 方法",
        "summary": "韩青、林芳华《二阶椭圆型偏微分方程》讨论班讲稿；部分估计内容有所缺失。",
        "topics": ["偏微分方程"],
        "kind": "讨论班讲稿", "pages": 11,
        "year": "2024", "date_label": "2024 年秋季",
    },
    {
        "path": "elliptic-pde/note1.pdf",
        "id": "pdf-elliptic-pde-lax-milgram",
        "title": "Lax–Milgram 定理",
        "summary": "二阶椭圆型偏微分方程讨论班讲稿。",
        "topics": ["偏微分方程", "泛函分析"],
        "kind": "讨论班讲稿", "pages": 5,
        "year": "2025", "date_label": "2025 年寒假",
    },
    {
        "path": "elliptic-pde/note2.1.pdf",
        "id": "pdf-elliptic-pde-variational-method",
        "title": "变分方法和一点泛函分析知识",
        "summary": "二阶椭圆型偏微分方程讨论班讲稿。",
        "topics": ["偏微分方程", "泛函分析"],
        "kind": "讨论班讲稿", "pages": 5,
        "year": "2025", "date_label": "2025 年寒假",
    },
    {
        "path": "elliptic-pde/note2.2.pdf",
        "id": "pdf-elliptic-pde-continuity-method",
        "title": "连续性方法",
        "summary": "二阶椭圆型偏微分方程讨论班讲稿。",
        "topics": ["偏微分方程"],
        "kind": "讨论班讲稿", "pages": 3,
        "year": "2025", "date_label": "2025 年寒假",
    },
    {
        "path": "elliptic-pde/note3.pdf",
        "id": "pdf-elliptic-pde-compactness-method",
        "title": "紧性方法",
        "summary": "二阶椭圆型偏微分方程讨论班讲稿。",
        "topics": ["偏微分方程"],
        "kind": "讨论班讲稿", "pages": 3,
        "year": "2025", "date_label": "2025 年寒假",
    },
    {
        "path": "elliptic-pde/note4.pdf",
        "id": "pdf-elliptic-pde-de-giorgi-viscosity",
        "title": "De Giorgi 迭代与粘性解笔记",
        "summary": "讨论班第四章与第五章部分内容的讲稿。",
        "topics": ["偏微分方程"],
        "kind": "讨论班讲稿", "pages": 10,
        "year": "2025", "date_label": "2025 年春季",
    },
    {
        "path": "Geometry/midterm.pdf",
        "id": "pdf-bochner-technique",
        "title": "Bochner 技巧及其应用",
        "summary": "从 Riemann 测度与微分算子出发，讨论 Hodge 理论和 Cheeger–Gromoll 分裂定理。",
        "topics": ["黎曼几何"],
        "kind": "课程论文", "pages": 27, "language": "英文",
    },
)

_catalog: list[dict] = []
_marker = re.compile(r"<!--\s*hm:catalog\s+scope=(all|math|writing)\s*-->")


def is_article(source: str) -> bool:
    return source == "movie.md" or (
        source.endswith(".md")
        and source.startswith(("math/reflections/", "writing/"))
    )


def build_catalog(files) -> list[dict]:
    """Read only public article metadata and explicitly listed PDF metadata."""
    entries = []
    for file in files:
        source = file.src_uri
        if not is_article(source):
            continue
        _, meta = get_data(file.content_string)
        required = ("title", "description", "comment_id")
        if any(not str(meta.get(key, "")).strip() for key in required):
            raise PluginError(f"{source}: catalog articles need title, description and comment_id")
        published = str(meta.get("date") or meta.get("updated") or "")
        if published:
            try:
                date.fromisoformat(published)
            except ValueError as error:
                raise PluginError(f"{source}: catalog date must be YYYY-MM-DD") from error
        topics = meta.get("tags", [])
        if not isinstance(topics, list):
            raise PluginError(f"{source}: tags must be a list")
        topics = [str(topic) for topic in topics]
        scope = "math" if source.startswith("math/") else "writing"
        kind = (
            "数学随想" if scope == "math"
            else "阅读摘记" if source.startswith("writing/reading/")
            else "电影札记" if source == "movie.md"
            else "随笔"
        )
        entries.append({
            "id": str(meta["comment_id"]), "url": file.url,
            "title": str(meta["title"]), "summary": str(meta["description"]),
            "topics": topics, "scope": scope, "kind": kind,
            "date": published, "year": published[:4],
            "date_label": ("更新于 " if not meta.get("date") and published else "") + published,
            "format": "article",
        })

    for descriptor in PDF_NOTES:
        file = files.get_file_from_path(descriptor["path"])
        if file is None:
            raise PluginError(f"Catalog PDF not found: {descriptor['path']}")
        entries.append({
            **descriptor, "scope": "math", "format": "pdf", "date": "",
            "url": file.url, "size_mb": len(file.content_bytes) / 1_000_000,
            "year": descriptor.get("year", ""),
            "date_label": descriptor.get("date_label", ""),
        })

    ids = [entry["id"] for entry in entries]
    if len(ids) != len(set(ids)):
        raise PluginError("Content catalog IDs must be unique")
    # Sort dated writing first, keeping undated resources at the end. Python's
    # stable sort preserves the teaching order of notes from the same year.
    return sorted(entries, key=lambda entry: entry["date"] or entry["year"], reverse=True)


def on_files(files, *, config):
    global _catalog
    _catalog = build_catalog(files)
    return files


def _e(value) -> str:
    return escape(str(value), quote=True)


def render_entry(entry: dict, page_url: str) -> str:
    url = _e(get_relative_url(entry["url"], page_url))
    title = _e(entry["title"])
    searchable = " ".join([
        entry["title"], entry["summary"], entry["kind"],
        "PDF" if entry["format"] == "pdf" else "",
        *entry["topics"],
    ])
    date_html = ""
    if entry.get("date"):
        date_html = f'<time datetime="{_e(entry["date"])}">{_e(entry["date_label"])}</time>'
    elif entry.get("date_label"):
        date_html = f'<span>{_e(entry["date_label"])}</span>'
    file_detail = ""
    if entry["format"] == "pdf":
        file_detail = f'PDF · {entry["pages"]} 页 · 约 {entry["size_mb"]:.2f} MB'
        if entry.get("language"):
            file_detail += f' · {entry["language"]}'
    tags = "".join(f'<span>{_e(tag)}</span>' for tag in entry["topics"])
    return (
        f'<article class="hm-entry" data-entry data-id="{_e(entry["id"])}" '
        f'data-scope="{_e(entry["scope"])}" data-year="{_e(entry["year"])}" '
        f'data-topics="{_e(json.dumps(entry["topics"], ensure_ascii=False))}" '
        f'data-search="{_e(searchable)}">'
        f'<div class="hm-entry-meta"><span>{_e(entry["kind"])}</span>{date_html}</div>'
        f'<h3 class="hm-entry-title"><a href="{url}">{title}</a></h3>'
        f'<p class="hm-entry-summary">{_e(entry["summary"])}</p>'
        + (f'<p class="hm-entry-format">{_e(file_detail)}</p>' if file_detail else '')
        + '<div class="hm-entry-footer">'
        f'<div class="hm-entry-tags" aria-label="主题">{tags}</div>'
        f'<button class="hm-save" type="button" data-save-id="{_e(entry["id"])}" '
        f'aria-pressed="false" aria-label="稍后读：{title}" hidden>稍后读</button>'
        '</div></article>'
    )


def render_catalog(entries: list[dict], scope: str, page_url: str) -> str:
    entries = [entry for entry in entries if scope == "all" or entry["scope"] == scope]
    years = sorted({entry["year"] for entry in entries if entry["year"]}, reverse=True)
    topics = sorted({topic for entry in entries for topic in entry["topics"]})
    year_options = "".join(f'<option value="{_e(year)}">{_e(year)} 年</option>' for year in years)
    topic_options = "".join(f'<option value="{_e(topic)}">{_e(topic)}</option>' for topic in topics)
    scopes = ""
    if scope == "all":
        scopes = '<div class="hm-library-scopes" role="group" aria-label="内容分区">' + "".join(
            f'<button type="button" data-library-scope="{value}" aria-pressed="{str(value == scope).lower()}">{label}</button>'
            for value, label in (("all", "全部"), ("math", "数学"), ("writing", "写作"))
        ) + '</div>'
    return (
        f'<section class="hm-library" data-library data-library-default-scope="{scope}" aria-label="内容目录">'
        '<div class="hm-library-controls" data-library-controls hidden>'
        + scopes +
        '<div class="hm-library-filters">'
        '<label class="hm-library-search"><span>搜索内容</span>'
        '<input type="search" data-library-query placeholder="标题、摘要或主题" autocomplete="off"></label>'
        '<label><span>年份</span><select data-library-year><option value="">全部年份</option>'
        + year_options + '</select></label>'
        '<label><span>主题</span><select data-library-topic><option value="">全部主题</option>'
        + topic_options + '</select></label>'
        '<button class="hm-save" type="button" data-library-saved aria-pressed="false">稍后读</button>'
        '</div>'
        '<p class="hm-library-local-note">稍后读仅保存在本浏览器，无需登录，不会上传。</p>'
        '</div>'
        f'<p class="hm-library-status" data-library-count role="status" aria-live="polite">共 {len(entries)} 项内容</p>'
        '<p class="hm-library-status" data-library-status role="status" aria-live="polite"></p>'
        '<div class="hm-library-results" data-library-results>'
        + "".join(render_entry(entry, page_url) for entry in entries) +
        '</div><div class="hm-library-empty" data-library-empty hidden>'
        '<p>没有符合条件的内容。试试其他关键词或取消筛选。</p>'
        '<button type="button" data-library-reset>清除筛选</button></div>'
        '</section>'
    )


def on_page_markdown(markdown, *, page, config, files):
    return _marker.sub(lambda match: render_catalog(_catalog, match.group(1), page.url), markdown)
