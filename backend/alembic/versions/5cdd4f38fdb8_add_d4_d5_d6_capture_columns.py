"""add_d4_d5_d6_capture_columns

Revision ID: 5cdd4f38fdb8
Revises: f91b44cf1e73
Create Date: 2026-04-20 12:25:42.837020

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5cdd4f38fdb8'
down_revision: Union[str, Sequence[str], None] = 'f91b44cf1e73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)

    tables = set(inspector.get_table_names())

    if "interview_answers" in tables:
        answer_cols = {c["name"] for c in inspector.get_columns("interview_answers")}
        if "time_to_first_word" not in answer_cols:
            op.add_column("interview_answers", sa.Column("time_to_first_word", sa.Float(), nullable=True))
        if "silence_gaps" not in answer_cols:
            op.add_column("interview_answers", sa.Column("silence_gaps", postgresql.JSONB(), nullable=True))
        if "answer_word_count" not in answer_cols:
            op.add_column("interview_answers", sa.Column("answer_word_count", sa.Integer(), nullable=True))

    if "interview_questions" in tables:
        question_cols = {c["name"] for c in inspector.get_columns("interview_questions")}
        if "topic" not in question_cols:
            op.add_column("interview_questions", sa.Column("topic", sa.String(length=100), nullable=True))
        if "difficulty" not in question_cols:
            op.add_column("interview_questions", sa.Column("difficulty", sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "interview_questions" in tables:
        question_cols = {c["name"] for c in inspector.get_columns("interview_questions")}
        if "difficulty" in question_cols:
            op.drop_column("interview_questions", "difficulty")
        if "topic" in question_cols:
            op.drop_column("interview_questions", "topic")

    if "interview_answers" in tables:
        answer_cols = {c["name"] for c in inspector.get_columns("interview_answers")}
        if "answer_word_count" in answer_cols:
            op.drop_column("interview_answers", "answer_word_count")
        if "silence_gaps" in answer_cols:
            op.drop_column("interview_answers", "silence_gaps")
        if "time_to_first_word" in answer_cols:
            op.drop_column("interview_answers", "time_to_first_word")
