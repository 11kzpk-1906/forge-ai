from app.application.chat.project_intelligence import (
    extract_github_url,
    parse_github_repository,
)


def test_parse_github_repository_accepts_repository_urls():
    assert parse_github_repository("https://github.com/openai/openai") == (
        "openai",
        "openai",
    )
    assert parse_github_repository("github.com/owner/project.git") == (
        "owner",
        "project",
    )


def test_parse_github_repository_rejects_non_github_hosts():
    assert parse_github_repository("https://example.com/owner/project") is None
    assert parse_github_repository("https://github.com.evil.example/owner/project") is None
    assert parse_github_repository("http://github.com/owner/project") is None


def test_parse_github_repository_requires_owner_and_repository():
    assert parse_github_repository("https://github.com/owner") is None
    assert parse_github_repository("https://github.com/") is None


def test_extract_github_url_finds_repository_in_chat_message():
    message = "Please review this project: https://github.com/owner/project and explain its structure."
    assert extract_github_url(message) == "https://github.com/owner/project"


def test_extract_github_url_ignores_untrusted_hosts():
    message = "Review https://github.com.evil.example/owner/project"
    assert extract_github_url(message) is None
