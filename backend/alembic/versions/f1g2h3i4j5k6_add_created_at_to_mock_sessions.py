"""Add created_at column to mock_sessions for recent-window reporting

Revision ID: f1g2h3i4j5k6
Revises: e0f1g2h3i4j5
Create Date: 2026-04-02 08:45:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1g2h3i4j5k6"
down_revision = "e0f1g2h3i4j5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mock_sessions",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # Preserve historical session timing semantics where available.
    op.execute("UPDATE mock_sessions SET created_at = started_at WHERE started_at IS NOT NULL")

    op.alter_column("mock_sessions", "created_at", nullable=False)
    op.create_index("ix_mock_sessions_created_at", "mock_sessions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_mock_sessions_created_at", table_name="mock_sessions")
    op.drop_column("mock_sessions", "created_at")
