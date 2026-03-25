"""add metadata definition scopes

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-24 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('metadata_definitions')}

    if 'scope' not in columns:
        op.add_column(
            'metadata_definitions',
            sa.Column('scope', sa.String(length=32), nullable=False, server_default='INVENTORY'),
        )

    if 'inventory_type' not in columns:
        op.add_column(
            'metadata_definitions',
            sa.Column('inventory_type', sa.String(length=16), nullable=True),
        )

    op.execute("UPDATE metadata_definitions SET scope = 'INVENTORY' WHERE scope IS NULL")

    op.alter_column('metadata_definitions', 'inventory_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('metadata_definitions', 'scope', existing_type=sa.String(length=32), server_default=None)

    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS uq_metadata_definitions_inventory_key")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_inventory_type")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope_target")

    op.execute(
        "ALTER TABLE metadata_definitions "
        "ADD CONSTRAINT ck_metadata_definitions_scope "
        "CHECK (scope IN ('GLOBAL', 'INVENTORY_TYPE', 'INVENTORY'))"
    )
    op.execute(
        "ALTER TABLE metadata_definitions "
        "ADD CONSTRAINT ck_metadata_definitions_inventory_type "
        "CHECK (inventory_type IS NULL OR inventory_type IN ('INVENTORY', 'CHECKLIST'))"
    )
    op.execute(
        "ALTER TABLE metadata_definitions "
        "ADD CONSTRAINT ck_metadata_definitions_scope_target "
        "CHECK ("
        "(scope = 'GLOBAL' AND inventory_id IS NULL AND inventory_type IS NULL) OR "
        "(scope = 'INVENTORY_TYPE' AND inventory_id IS NULL AND inventory_type IS NOT NULL) OR "
        "(scope = 'INVENTORY' AND inventory_id IS NOT NULL)"
        ")"
    )

    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_metadata_definitions_global_key_idx "
        "ON metadata_definitions (key) WHERE scope = 'GLOBAL'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_metadata_definitions_type_key_idx "
        "ON metadata_definitions (inventory_type, key) WHERE scope = 'INVENTORY_TYPE'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_metadata_definitions_inventory_key_idx "
        "ON metadata_definitions (inventory_id, key) WHERE scope = 'INVENTORY'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metadata_definitions_scope "
        "ON metadata_definitions (scope)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metadata_definitions_inventory_type "
        "ON metadata_definitions (inventory_type)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_inventory_type")
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_scope")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_inventory_key_idx")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_type_key_idx")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_global_key_idx")

    op.execute("DELETE FROM metadata_definitions WHERE scope != 'INVENTORY'")

    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope_target")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_inventory_type")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope")

    op.alter_column('metadata_definitions', 'inventory_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('metadata_definitions', 'inventory_type')
    op.drop_column('metadata_definitions', 'scope')
    op.create_unique_constraint(
        'uq_metadata_definitions_inventory_key',
        'metadata_definitions',
        ['inventory_id', 'key'],
    )
