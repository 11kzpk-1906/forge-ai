from app.application.repositories.codebase_intelligence import (
    _included_path,
    _language_for,
    parse_github_repository,
)


def test_parse_github_repository_accepts_supported_urls():
    assert parse_github_repository("https://github.com/openai/openai") == (
        "openai", "openai"
    )
    assert parse_github_repository("github.com/owner/project.git") == (
        "owner", "project"
    )
    assert parse_github_repository("owner/project") is None


def test_parse_github_repository_rejects_non_github_hosts_and_unsafe_urls():
    assert parse_github_repository("https://example.com/owner/project") is None
    assert parse_github_repository("https://github.com.evil.example/owner/project") is None
    assert parse_github_repository("http://github.com/owner/project") is None
    assert parse_github_repository("https://user:pass@github.com/owner/project") is None
    assert parse_github_repository("https://github.com/owner") is None


def test_ignored_dependency_and_generated_directories_are_excluded():
    assert not _included_path("src/node_modules/package/index.js")
    assert not _included_path(".git/config")
    assert _included_path("src/app/main.py")


def test_common_source_extensions_map_to_languages():
    assert _language_for("apps/api/main.py") == "Python"
    assert _language_for("apps/web/App.tsx") == "TypeScript"
    assert _language_for("src/index.rs") == "Rust"
    assert _language_for("README.md") is None
