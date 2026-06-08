"""Add coach_note to mock_sessions

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("mock_sessions", sa.Column("coach_note", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("mock_sessions", "coach_note")
