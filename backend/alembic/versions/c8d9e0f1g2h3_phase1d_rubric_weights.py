"""Phase 1D: Add rubric_weights to roles table

Revision ID: c8d9e0f1g2h3
Revises: b2c3d4e5f6g7
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c8d9e0f1g2h3'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('roles', sa.Column('rubric_weights', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index(op.f('ix_roles_rubric_weights'), 'roles', ['rubric_weights'], postgresql_using='gin')


def downgrade() -> None:
    op.drop_index(op.f('ix_roles_rubric_weights'), table_name='roles')
    op.drop_column('roles', 'rubric_weights')
