"""Phase 2a: Add mock_sessions and communication_reports tables

Revision ID: e0f1g2h3i4j5
Revises: d9e0f1g2h3i4
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = "e0f1g2h3i4j5"
down_revision = "d9e0f1g2h3i4"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "mock_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("guest_token", sa.Text(), nullable=True),
        sa.Column("role_target", sa.Text(), nullable=False),
        sa.Column("seniority", sa.Text(), nullable=False),
        sa.Column("company_type", sa.Text(), nullable=True),
        sa.Column("focus_area", sa.Text(), nullable=True),
        sa.Column("resume_uploaded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("duration_mins", sa.Integer(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'in_progress'")),
        sa.Column("overall_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("dsa_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("system_design_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("behavioral_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("communication_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_mock_sessions_user_id", "mock_sessions", ["user_id"])
    op.create_index("ix_mock_sessions_guest_token", "mock_sessions", ["guest_token"])
    op.create_index("ix_mock_sessions_status", "mock_sessions", ["status"])

    op.create_table(
        "communication_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("mock_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("avg_wpm", sa.Numeric(6, 2), nullable=True),
        sa.Column("total_filler_words", sa.Integer(), nullable=True),
        sa.Column("filler_breakdown", JSONB, nullable=True),
        sa.Column("total_silence_gaps", sa.Integer(), nullable=True),
        sa.Column("longest_silence_sec", sa.Numeric(6, 2), nullable=True),
        sa.Column("star_avg_score", sa.Numeric(4, 2), nullable=True),
        sa.Column("heatmap_data", JSONB, nullable=True),
        sa.Column("top_issues", sa.ARRAY(sa.Text()), nullable=True),
        sa.Column("top_strengths", sa.ARRAY(sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_comm_reports_session_id", "communication_reports", ["session_id"])


def downgrade():
    op.drop_index("ix_comm_reports_session_id", table_name="communication_reports")
    op.drop_table("communication_reports")

    op.drop_index("ix_mock_sessions_status", table_name="mock_sessions")
    op.drop_index("ix_mock_sessions_guest_token", table_name="mock_sessions")
    op.drop_index("ix_mock_sessions_user_id", table_name="mock_sessions")
    op.drop_table("mock_sessions")
