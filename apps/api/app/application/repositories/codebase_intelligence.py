from __future__ import annotations

import re
from collections import Counter
from urllib.parse import urlparse

import httpx

_GITHUB_API = "https://api.github.com"
_MAX_TREE_ENTRIES = 500
_MAX_SOURCE_FILES = 18
_MAX_SOURCE_BYTES = 80_000
_SOURCE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".cs",
    ".php", ".rb", ".swift", ".kt",
}
_IGNORED_PARTS = {
    "node_modules", "vendor", ".git", "dist", "build", ".next",
    "__pycache__", ".venv", "venv", "coverage",
}
_SYMBOL_PATTERNS = (
    re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)", re.MULTILINE),
    re.compile(r"^\s*class\s+([A-Za-z_]\w*)", re.MULTILINE),
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.MULTILINE),
    re.compile(r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)", re.MULTILINE),
    re.compile(r"^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=", re.MULTILINE),
)
_MANIFESTS = (
    "package.json", "pnpm-workspace.yaml", "pyproject.toml", "requirements.txt",
    "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "Gemfile",
    "composer.json", "Dockerfile", "docker-compose.yml",
)
_FRAMEWORK_HINTS = {
    "next.config.js": "Next.js",
    "next.config.ts": "Next.js",
    "vite.config.ts": "Vite",
    "vite.config.js": "Vite",
    "angular.json": "Angular",
    "manage.py": "Django",
    "Cargo.toml": "Rust",
    "go.mod": "Go",
}


def parse_github_repository(value: str) -> tuple[str, str] | None:
    """Accept only canonical github.com repository URLs or owner/name slugs."""
    raw = (value or "").strip()
    if not raw:
        return None
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    if parsed.scheme != "https" or parsed.hostname not in {"github.com", "www.github.com"}:
        return None
    if parsed.port not in (None, 443) or parsed.username or parsed.password:
        return None
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) != 2:
        return None
    owner, name = parts
    if name.endswith(".git"):
        name = name[:-4]
    valid = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
    if not valid.fullmatch(owner) or not valid.fullmatch(name) or name in {".", ".."}:
        return None
    return owner, name


def _included_path(path: str) -> bool:
    parts = path.split("/")
    return not any(part in _IGNORED_PARTS for part in parts)


def _language_for(path: str) -> str | None:
    extension = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript",
        ".js": "JavaScript", ".jsx": "JavaScript", ".go": "Go",
        ".rs": "Rust", ".java": "Java", ".cs": "C#", ".php": "PHP",
        ".rb": "Ruby", ".swift": "Swift", ".kt": "Kotlin",
    }.get(extension)


async def analyze_github_repository(repository_url: str) -> dict:
    parsed = parse_github_repository(repository_url)
    if not parsed:
        raise ValueError("Enter a valid public GitHub repository URL, such as https://github.com/owner/repo.")

    owner, name = parsed
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ForgeAI-Codebase-Intelligence",
    }
    timeout = httpx.Timeout(12.0, connect=5.0)
    async with httpx.AsyncClient(
        base_url=_GITHUB_API,
        headers=headers,
        timeout=timeout,
        follow_redirects=False,
    ) as client:
        repo_response = await client.get(f"/repos/{owner}/{name}")
        if repo_response.status_code == 404:
            raise LookupError("Repository not found or not publicly accessible.")
        if repo_response.status_code == 403:
            raise RuntimeError("GitHub API rate limit reached. Try again later.")
        repo_response.raise_for_status()
        metadata = repo_response.json()
        if metadata.get("private"):
            raise PermissionError("This first version supports public repositories only.")

        default_branch = metadata.get("default_branch") or "main"
        tree_response = await client.get(
            f"/repos/{owner}/{name}/git/trees/{default_branch}",
            params={"recursive": "1"},
        )
        if tree_response.status_code == 403:
            raise RuntimeError("GitHub API rate limit reached while reading the repository.")
        tree_response.raise_for_status()
        tree_payload = tree_response.json()
        entries = [
            item for item in tree_payload.get("tree", [])
            if item.get("type") == "blob" and _included_path(item.get("path", ""))
        ]
        truncated = bool(tree_payload.get("truncated")) or len(entries) > _MAX_TREE_ENTRIES
        entries = entries[:_MAX_TREE_ENTRIES]

        paths = [item["path"] for item in entries]
        directories = sorted({
            path.split("/")[0] for path in paths if "/" in path
        })
        languages = Counter(
            language for path in paths if (language := _language_for(path))
        )
        manifest_names = {path.rsplit("/", 1)[-1] for path in paths}
        manifests = sorted(manifest_names.intersection(_MANIFESTS))
        frameworks = sorted(
            hint for filename, hint in _FRAMEWORK_HINTS.items()
            if filename in manifest_names
        )

        source_candidates = [
            item for item in entries
            if any(item["path"].endswith(ext) for ext in _SOURCE_EXTENSIONS)
            and item.get("size", 0) <= 20_000
        ][: _MAX_SOURCE_FILES]
        symbols: list[dict[str, str]] = []
        scanned_bytes = 0
        for item in source_candidates:
            size = int(item.get("size") or 0)
            if scanned_bytes + size > _MAX_SOURCE_BYTES:
                continue
            response = await client.get(
                f"/repos/{owner}/{name}/contents/{item['path']}",
                params={"ref": default_branch},
                headers={"Accept": "application/vnd.github.raw+json"},
            )
            if response.status_code != 200:
                continue
            source = response.text
            scanned_bytes += len(response.content)
            found = []
            for pattern in _SYMBOL_PATTERNS:
                found.extend(pattern.findall(source))
            for symbol in dict.fromkeys(found):
                symbols.append({"name": symbol, "file": item["path"]})
                if len(symbols) >= 100:
                    break
            if len(symbols) >= 100:
                break

    return {
        "repository": f"{owner}/{name}",
        "url": f"https://github.com/{owner}/{name}",
        "description": metadata.get("description"),
        "default_branch": default_branch,
        "stars": metadata.get("stargazers_count", 0),
        "file_count": len(paths),
        "tree_truncated": truncated,
        "languages": [
            {"name": language, "files": count}
            for language, count in languages.most_common(8)
        ],
        "top_level_directories": directories[:40],
        "dependency_and_config_manifests": manifests,
        "framework_hints": frameworks,
        "indexed_symbols": symbols,
        "symbol_files_scanned": len(source_candidates),
        "limitations": [
            "Only public GitHub repositories are supported in this version.",
            "The symbol index is a bounded static scan, not a complete language-aware parser.",
            "Generated, vendor, build, and dependency folders are excluded.",
        ],
    }
