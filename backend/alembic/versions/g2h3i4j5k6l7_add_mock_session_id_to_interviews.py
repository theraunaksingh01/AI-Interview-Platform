"""Add mock_session_id to interviews

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-04-02 09:10:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "g2h3i4j5k6l7"
down_revision = "f1g2h3i4j5k6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interviews", sa.Column("mock_session_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_interviews_mock_session_id",
        "interviews",
        "mock_sessions",
        ["mock_session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_i_mock_session_id", "interviews", ["mock_session_id"])


def downgrade() -> None:
    op.drop_index("ix_i_mock_session_id", table_name="interviews")
    op.drop_constraint("fk_interviews_mock_session_id", "interviews", type_="foreignkey")
    op.drop_column("interviews", "mock_session_id")
