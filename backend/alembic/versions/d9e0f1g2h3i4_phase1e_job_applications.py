"""Phase 1e: Add job_applications table and link to interviews

Revision ID: d9e0f1g2h3i4
Revises: c8d9e0f1g2h3
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "d9e0f1g2h3i4"
down_revision = "c8d9e0f1g2h3"
branch_labels = None
depends_on = None


def upgrade():
    # Create job_applications table
    op.create_table(
        "job_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_email", sa.String(255), nullable=False),
        sa.Column("candidate_name", sa.String(255), nullable=True),
        sa.Column("attempt_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(50), server_default="invited", nullable=False),
        sa.Column("invite_token", sa.String(255), unique=True, nullable=False),
        sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes
    op.create_index("ix_ja_job_id", "job_applications", ["job_id"])
    op.create_index("ix_ja_candidate_email", "job_applications", ["candidate_email"])
    op.create_index("ix_ja_status", "job_applications", ["status"])
    op.create_index("ix_ja_invite_token", "job_applications", ["invite_token"])

    # Add application_id to interviews table to link to job_applications
    op.add_column(
        "interviews",
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=True),
    )

    op.create_index("ix_i_application_id", "interviews", ["application_id"])


def downgrade():
    op.drop_column("interviews", "application_id")
    op.drop_table("job_applications")
