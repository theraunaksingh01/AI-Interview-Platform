"""Phase 1c: Add cheat_signals table for comprehensive anti-cheat detection

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    # Create cheat_signals table to track individual signals per answer
    op.create_table(
        "cheat_signals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("interview_id", sa.Integer(), sa.ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("interview_answer_id", sa.Integer(), sa.ForeignKey("interview_answers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("signal_type", sa.String(50), nullable=False),  # TAB_FOCUS_LOST, PASTE_EVENT, etc.
        sa.Column("signal_category", sa.String(1), nullable=False),  # A, B, C, D
        sa.Column("weight", sa.String(10), nullable=False),  # low, medium, high
        sa.Column("details", JSONB, nullable=True),  # timestamp, duration, context, etc.
        sa.Column("fired_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Indexes for efficient querying
    op.create_index("ix_cs_interview_id", "cheat_signals", ["interview_id"])
    op.create_index("ix_cs_answer_id", "cheat_signals", ["interview_answer_id"])
    op.create_index("ix_cs_signal_type", "cheat_signals", ["signal_type"])
    op.create_index("ix_cs_signal_category", "cheat_signals", ["signal_category"])

    # Add cheat_score column to interview_answers (per-answer score: 0-100)
    op.add_column(
        "interview_answers",
        sa.Column("cheat_score", sa.Numeric(precision=5, scale=2), nullable=True),
    )

    # Add cheat_risk column to interview_answers (categorical: low, medium, high, very_high)
    op.add_column(
        "interview_answers",
        sa.Column("cheat_risk", sa.String(20), nullable=True, server_default="low"),
    )


def downgrade():
    op.drop_column("interview_answers", "cheat_risk")
    op.drop_column("interview_answers", "cheat_score")
    op.drop_index("ix_cs_signal_category", table_name="cheat_signals")
    op.drop_index("ix_cs_signal_type", table_name="cheat_signals")
    op.drop_index("ix_cs_answer_id", table_name="cheat_signals")
    op.drop_index("ix_cs_interview_id", table_name="cheat_signals")
    op.drop_table("cheat_signals")
