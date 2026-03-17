"""Phase 12: add parent_question_id + role_difficulty_calibration

Revision ID: a1b2c3d4e5f6
Revises: 2c76cc1c5dea
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "2c76cc1c5dea"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Add parent_question_id to interview_questions for follow-up linking
    op.add_column(
        "interview_questions",
        sa.Column("parent_question_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_iq_parent_question",
        "interview_questions",
        "interview_questions",
        ["parent_question_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_iq_parent_question_id",
        "interview_questions",
        ["parent_question_id"],
    )

    # 2) Create role_difficulty_calibration table
    op.create_table(
        "role_difficulty_calibration",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("avg_score", sa.Float(), nullable=True),
        sa.Column("total_interviews", sa.Integer(), server_default="0", nullable=False),
        sa.Column("difficulty_profile", JSONB, server_default="{}", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_rdc_role_id",
        "role_difficulty_calibration",
        ["role_id"],
        unique=True,
    )


def downgrade():
    op.drop_table("role_difficulty_calibration")
    op.drop_index("ix_iq_parent_question_id", table_name="interview_questions")
    op.drop_constraint("fk_iq_parent_question", "interview_questions", type_="foreignkey")
    op.drop_column("interview_questions", "parent_question_id")
