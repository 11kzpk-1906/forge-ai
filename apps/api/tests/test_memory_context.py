from app.application.chat.memory_context import (
    _expand_query_terms,
    _is_core_memory,
    _relevance_score,
)


def test_project_questions_expand_to_repository_vocabulary():
    terms = _expand_query_terms("What projects am I working on?")

    assert "project" in terms
    assert "repository" in terms
    assert "codebase" in terms


def test_education_questions_expand_to_school_and_degree_vocabulary():
    terms = _expand_query_terms("What is my future education plan?")

    assert "education" in terms
    assert "university" in terms
    assert "degree" in terms


def test_profile_memory_is_recognized_without_explicit_tag():
    memory = {
        "title": "Personal notes",
        "content": "I am a student. My interests include AI and software engineering.",
        "tags": [],
    }

    assert _is_core_memory(memory)


def test_matching_project_title_ranks_above_unrelated_preference():
    terms = _expand_query_terms("What projects am I building?")
    project_memory = {
        "title": "ForgeAI project",
        "content": "Building an AI software engineering assistant.",
        "tags": ["software", "repository"],
    }
    preference_memory = {
        "title": "UI preferences",
        "content": "Prefers a dark interface.",
        "tags": ["design"],
    }

    assert _relevance_score(project_memory, terms) > _relevance_score(
        preference_memory, terms
    )
