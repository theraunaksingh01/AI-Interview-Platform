from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "6ea00884ae5a"
down_revision = "2d72a4ca1381"
branch_labels = None
depends_on = None


def upgrade():
    # string-based enum storage for portability
    op.add_column("uploads", sa.Column("status", sa.String(), nullable=False, server_default="pending"))
    op.add_column("uploads", sa.Column("processor_job_id", sa.String(length=255), nullable=True))
    op.add_column("uploads", sa.Column("transcript", sa.Text(), nullable=True))
    op.add_column(
        "uploads",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # indexes (optional but useful for lookups)
    op.create_index("ix_uploads_processor_job_id", "uploads", ["processor_job_id"], unique=False)

    # (optional) drop server default after backfilling existing rows
    op.execute("ALTER TABLE uploads ALTER COLUMN status DROP DEFAULT")


def downgrade():
    op.drop_index("ix_uploads_processor_job_id", table_name="uploads")
    op.drop_column("uploads", "updated_at")
    op.drop_column("uploads", "transcript")
    op.drop_column("uploads", "processor_job_id")
    op.drop_column("uploads", "status")
