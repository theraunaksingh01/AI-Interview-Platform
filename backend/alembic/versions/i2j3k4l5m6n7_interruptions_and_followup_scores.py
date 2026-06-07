"""Add interruptions and follow_up_scores tracking tables

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "interruptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("interview_id", UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=True),
        sa.Column("trigger_type", sa.String(20), nullable=False),
        sa.Column("transcript_at_trigger", sa.Text(), nullable=True),
        sa.Column("interruption_text", sa.Text(), nullable=False),
        sa.Column("was_fallback", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("interrupt_type", sa.String(20), server_default="content"),
        sa.Column("timestamp_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_interruptions_interview", "interruptions", ["interview_id"])

    op.create_table(
        "follow_up_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("interview_id", UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("followup_question_id", sa.Integer(), nullable=True),
        sa.Column("original_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("followup_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("depth_revealed", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_followup_scores_interview", "follow_up_scores", ["interview_id"])


def downgrade():
    op.drop_index("idx_followup_scores_interview", table_name="follow_up_scores")
    op.drop_table("follow_up_scores")
    op.drop_index("idx_interruptions_interview", table_name="interruptions")
    op.drop_table("interruptions")
