"""add metadata EAV tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'metadata_definitions' not in existing_tables:
        op.create_table(
            'metadata_definitions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('inventory_id', sa.Integer(), sa.ForeignKey('inventories.id', ondelete='CASCADE'), nullable=False),
            sa.Column('key', sa.String(length=64), nullable=False),
            sa.Column('label', sa.String(length=128), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('field_type', sa.String(length=16), nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('data_ins', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('data_mod', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('user_ins', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('user_mod', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.UniqueConstraint('inventory_id', 'key', name='uq_metadata_definitions_inventory_key'),
            sa.CheckConstraint(
                "field_type IN ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE')",
                name='ck_metadata_definitions_field_type',
            ),
        )

    if 'item_metadata_values' not in existing_tables:
        op.create_table(
            'item_metadata_values',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('item_id', sa.Integer(), sa.ForeignKey('items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('definition_id', sa.Integer(), sa.ForeignKey('metadata_definitions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('value_text', sa.Text(), nullable=True),
            sa.Column('value_number', sa.Numeric(14, 4), nullable=True),
            sa.Column('value_boolean', sa.Boolean(), nullable=True),
            sa.Column('value_date', sa.Date(), nullable=True),
            sa.Column('data_ins', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('data_mod', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('user_ins', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('user_mod', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.UniqueConstraint('item_id', 'definition_id', name='uq_item_metadata_values_item_definition'),
            sa.CheckConstraint(
                "(" 
                "CASE WHEN value_text IS NOT NULL THEN 1 ELSE 0 END + "
                "CASE WHEN value_number IS NOT NULL THEN 1 ELSE 0 END + "
                "CASE WHEN value_boolean IS NOT NULL THEN 1 ELSE 0 END + "
                "CASE WHEN value_date IS NOT NULL THEN 1 ELSE 0 END"
                ") = 1",
                name='ck_item_metadata_values_single_typed_value',
            ),
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metadata_definitions_inventory_id "
        "ON metadata_definitions (inventory_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_metadata_definitions_inventory_sort "
        "ON metadata_definitions (inventory_id, sort_order, id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_item_id "
        "ON item_metadata_values (item_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_definition_id "
        "ON item_metadata_values (definition_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_value_text "
        "ON item_metadata_values (value_text)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_value_number "
        "ON item_metadata_values (value_number)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_value_boolean "
        "ON item_metadata_values (value_boolean)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_item_metadata_values_value_date "
        "ON item_metadata_values (value_date)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_value_date")
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_value_boolean")
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_value_number")
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_value_text")
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_definition_id")
    op.execute("DROP INDEX IF EXISTS ix_item_metadata_values_item_id")
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_inventory_sort")
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_inventory_id")
    op.drop_table('item_metadata_values')
    op.drop_table('metadata_definitions')