"""add_category_d_columns

Revision ID: f91b44cf1e73
Revises: g2h3i4j5k6l7
Create Date: 2026-04-20 12:09:58.519674

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f91b44cf1e73'
down_revision: Union[str, Sequence[str], None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)

    tables = set(inspector.get_table_names())

    # Add is_followup to the first available answers table.
    answer_table = None
    for candidate in ("interview_responses", "interview_answers"):
        if candidate in tables:
            answer_table = candidate
            break

    if answer_table:
        answer_cols = {c["name"] for c in inspector.get_columns(answer_table)}
        if "is_followup" not in answer_cols:
            op.add_column(
                answer_table,
                sa.Column("is_followup", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            )

    # Add payload JSONB to cheat_signals if neither payload nor json_data exists.
    if "cheat_signals" in tables:
        cheat_cols = {c["name"] for c in inspector.get_columns("cheat_signals")}
        if "payload" not in cheat_cols and "json_data" not in cheat_cols:
            op.add_column("cheat_signals", sa.Column("payload", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    if "cheat_signals" in tables:
        cheat_cols = {c["name"] for c in inspector.get_columns("cheat_signals")}
        if "payload" in cheat_cols:
            op.drop_column("cheat_signals", "payload")

    for candidate in ("interview_responses", "interview_answers"):
        if candidate in tables:
            answer_cols = {c["name"] for c in inspector.get_columns(candidate)}
            if "is_followup" in answer_cols:
                op.drop_column(candidate, "is_followup")
            break
