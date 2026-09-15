"""Fail the build when a comment-enabled page lacks a stable, unique ID."""

from __future__ import annotations

import re

from mkdocs.exceptions import PluginError


COMMENT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{2,95}$")
_comment_ids: dict[str, str] = {}


def on_pre_build(*, config) -> None:
    _comment_ids.clear()


def on_page_markdown(markdown, *, page, config, files):
    if not page.meta.get("comments", False):
        return markdown

    comment_id = str(page.meta.get("comment_id", "")).strip()
    source = page.file.src_uri

    if not comment_id:
        raise PluginError(f"{source}: comments is enabled but comment_id is missing")
    if not COMMENT_ID_PATTERN.fullmatch(comment_id):
        raise PluginError(
            f"{source}: comment_id must contain only lowercase letters, digits, and hyphens"
        )
    if comment_id in _comment_ids:
        raise PluginError(
            f"{source}: duplicate comment_id '{comment_id}' also used by {_comment_ids[comment_id]}"
        )

    mapping = str(page.meta.get("comment_mapping", "specific")).strip()
    if mapping not in {"specific", "number"}:
        raise PluginError(f"{source}: comment_mapping must be 'specific' or 'number'")
    if mapping == "number":
        term = str(page.meta.get("comment_term", "")).strip()
        if not term.isdigit() or int(term) < 1:
            raise PluginError(
                f"{source}: number mapping requires a positive integer comment_term"
            )

    _comment_ids[comment_id] = source
    return markdown
