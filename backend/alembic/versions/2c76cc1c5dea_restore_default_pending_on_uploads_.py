from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "<put_new_rev_id_here>"
down_revision = "6ea00884ae5a"
branch_labels = None
depends_on = None

def upgrade():
    # set default for new rows
    op.alter_column("uploads", "status", server_default="pending")
    # if any existing NULLs slipped in (unlikely due to NOT NULL), backfill:
    op.execute("UPDATE uploads SET status='pending' WHERE status IS NULL")

def downgrade():
    # remove default again (not the NOT NULL constraint)
    op.alter_column("uploads", "status", server_default=None)
