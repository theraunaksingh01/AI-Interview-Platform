"""add user profile fields

Revision ID: h1i2j3k4l5m6
Revises: f91b44cf1e73
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "h1i2j3k4l5m6"
down_revision = "f91b44cf1e73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("college", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("year_of_study", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("branch", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("placement_goal", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("target_roles", JSONB, nullable=True))
    op.add_column("users", sa.Column("self_level", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("onboarding_done", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("target_companies", JSONB, nullable=True))
    op.add_column("users", sa.Column("linkedin_url", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("github_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "github_url")
    op.drop_column("users", "linkedin_url")
    op.drop_column("users", "target_companies")
    op.drop_column("users", "onboarding_done")
    op.drop_column("users", "self_level")
    op.drop_column("users", "target_roles")
    op.drop_column("users", "placement_goal")
    op.drop_column("users", "branch")
    op.drop_column("users", "year_of_study")
    op.drop_column("users", "college")