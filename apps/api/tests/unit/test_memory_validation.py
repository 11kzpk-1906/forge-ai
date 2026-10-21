import pytest
from pydantic import ValidationError

from app.api.v1.memory import MemoryInput, MemoryUpdate, _normalize_tags


def test_memory_input_requires_non_blank_fields():
    with pytest.raises(ValidationError):
        MemoryInput(title="", content="Remember this")

    with pytest.raises(ValidationError):
        MemoryInput(title="Useful note", content="")


def test_memory_input_limits_content_length():
    with pytest.raises(ValidationError):
        MemoryInput(title="Too long", content="x" * 12_001)


def test_memory_update_requires_at_least_one_field_at_endpoint_layer():
    # An empty model is valid to deserialize; the endpoint rejects it with 422.
    assert MemoryUpdate().model_dump(exclude_unset=True) == {}


def test_normalize_tags_trims_and_deduplicates_case_insensitively():
    assert _normalize_tags([" Python ", "python", "API", "", "api"]) == [
        "Python",
        "API",
    ]
