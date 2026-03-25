"""add metadata definition assignments table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-03-24 19:00:00.000000

Questo migration:
1. Crea la tabella metadata_definition_assignments
2. Migra i dati esistenti da metadata_definitions verso le assegnazioni
3. Rimuove le colonne scope/inventory_type/inventory_id da metadata_definitions
4. Aggiunge vincolo di unicità sulla chiave
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = 'a1b2c3d4e5f6'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = {t for t in inspector.get_table_names()}

    # --- 1. Crea la tabella metadata_definition_assignments ---
    if 'metadata_definition_assignments' not in existing_tables:
        op.create_table(
            'metadata_definition_assignments',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('definition_id', sa.Integer(), sa.ForeignKey('metadata_definitions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('scope', sa.String(32), nullable=False),
            sa.Column('inventory_type', sa.String(16), nullable=True),
            sa.Column('inventory_id', sa.Integer(), sa.ForeignKey('inventories.id', ondelete='CASCADE'), nullable=True),
            sa.Column('data_ins', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('data_mod', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('user_ins', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('user_mod', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.CheckConstraint("scope IN ('GLOBAL', 'INVENTORY_TYPE', 'INVENTORY')", name='ck_mda_scope'),
            sa.CheckConstraint(
                "inventory_type IS NULL OR inventory_type IN ('INVENTORY', 'CHECKLIST')",
                name='ck_mda_inventory_type',
            ),
            sa.CheckConstraint(
                "(scope = 'GLOBAL' AND inventory_id IS NULL AND inventory_type IS NULL) OR "
                "(scope = 'INVENTORY_TYPE' AND inventory_id IS NULL AND inventory_type IS NOT NULL) OR "
                "(scope = 'INVENTORY' AND inventory_id IS NOT NULL)",
                name='ck_mda_scope_target',
            ),
        )
        op.create_index('ix_mda_definition_id', 'metadata_definition_assignments', ['definition_id'])
        op.create_index('ix_mda_inventory_id', 'metadata_definition_assignments', ['inventory_id'])
        op.create_index('ix_mda_inventory_type', 'metadata_definition_assignments', ['inventory_type'])
        op.create_index('ix_mda_scope', 'metadata_definition_assignments', ['scope'])
        # Partial unique indexes
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_mda_global_def "
            "ON metadata_definition_assignments (definition_id) WHERE scope = 'GLOBAL'"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_mda_type_def "
            "ON metadata_definition_assignments (definition_id, inventory_type) WHERE scope = 'INVENTORY_TYPE'"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_mda_inventory_def "
            "ON metadata_definition_assignments (definition_id, inventory_id) WHERE scope = 'INVENTORY'"
        )

    # --- 2. Verifica colonne esistenti in metadata_definitions ---
    md_columns = {col['name'] for col in inspector.get_columns('metadata_definitions')}

    # --- 3. Migra i dati esistenti verso le assegnazioni ---
    # Caso A: la migration f6a7b8c9d0e1 è già stata applicata (colonne scope/inventory_type esistono)
    if 'scope' in md_columns:
        bind.execute(text("""
            INSERT INTO metadata_definition_assignments (definition_id, scope, inventory_type, inventory_id, data_ins, data_mod)
            SELECT
                id,
                scope,
                inventory_type,
                CASE WHEN scope = 'INVENTORY' THEN inventory_id ELSE NULL END,
                data_ins,
                data_mod
            FROM metadata_definitions
            WHERE id NOT IN (
                SELECT DISTINCT definition_id FROM metadata_definition_assignments
            )
        """))

    # Caso B: colonna scope non esiste ma inventory_id è NOT NULL (design originale pre-f6a7b8c9d0e1)
    elif 'inventory_id' in md_columns:
        bind.execute(text("""
            INSERT INTO metadata_definition_assignments (definition_id, scope, inventory_type, inventory_id, data_ins, data_mod)
            SELECT
                md.id,
                'INVENTORY',
                i.type,
                md.inventory_id,
                md.data_ins,
                md.data_mod
            FROM metadata_definitions md
            JOIN inventories i ON i.id = md.inventory_id
            WHERE md.id NOT IN (
                SELECT DISTINCT definition_id FROM metadata_definition_assignments
            )
        """))

    # --- 4. Drop colonne scope/inventory_type/inventory_id da metadata_definitions ---
    # Prima rimuove vincoli/indici che li referenziano
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_inventory_type")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS ck_metadata_definitions_scope_target")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_global_key_idx")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_type_key_idx")
    op.execute("DROP INDEX IF EXISTS uq_metadata_definitions_inventory_key_idx")
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_scope")
    op.execute("DROP INDEX IF EXISTS ix_metadata_definitions_inventory_type")
    op.execute("ALTER TABLE metadata_definitions DROP CONSTRAINT IF EXISTS uq_metadata_definitions_inventory_key")

    if 'scope' in md_columns:
        op.drop_column('metadata_definitions', 'scope')
    if 'inventory_type' in md_columns:
        op.drop_column('metadata_definitions', 'inventory_type')
    if 'inventory_id' in md_columns:
        op.drop_column('metadata_definitions', 'inventory_id')

    # --- 5. Aggiunge vincolo unico sulla chiave globale ---
    existing_constraints = {c['name'] for c in inspector.get_unique_constraints('metadata_definitions')}
    if 'uq_metadata_definitions_key' not in existing_constraints:
        op.create_unique_constraint('uq_metadata_definitions_key', 'metadata_definitions', ['key'])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    md_columns = {col['name'] for col in inspector.get_columns('metadata_definitions')}

    # Rimuove vincolo unico sulla chiave
    existing_constraints = {c['name'] for c in inspector.get_unique_constraints('metadata_definitions')}
    if 'uq_metadata_definitions_key' in existing_constraints:
        op.drop_constraint('uq_metadata_definitions_key', 'metadata_definitions', type_='unique')

    # Ripristina colonne scope/inventory_type/inventory_id
    if 'scope' not in md_columns:
        op.add_column('metadata_definitions', sa.Column('scope', sa.String(32), nullable=False, server_default='INVENTORY'))
    if 'inventory_type' not in md_columns:
        op.add_column('metadata_definitions', sa.Column('inventory_type', sa.String(16), nullable=True))
    if 'inventory_id' not in md_columns:
        op.add_column('metadata_definitions', sa.Column('inventory_id', sa.Integer(), sa.ForeignKey('inventories.id', ondelete='CASCADE'), nullable=True))

    # Ripristina dati da assignments → definitions (solo scope INVENTORY)
    bind.execute(text("""
        UPDATE metadata_definitions md
        SET scope = a.scope,
            inventory_type = a.inventory_type,
            inventory_id = a.inventory_id
        FROM metadata_definition_assignments a
        WHERE a.definition_id = md.id AND a.scope = 'INVENTORY'
    """))

    # Elimina definizioni che non hanno assegnazione INVENTORY (non ripristinabili)
    bind.execute(text("""
        DELETE FROM metadata_definitions
        WHERE id NOT IN (
            SELECT definition_id FROM metadata_definition_assignments WHERE scope = 'INVENTORY'
        )
    """))

    # Ripristina indici/constraint
    op.create_unique_constraint('uq_metadata_definitions_inventory_key', 'metadata_definitions', ['inventory_id', 'key'])
    op.execute("ALTER TABLE metadata_definitions ALTER COLUMN inventory_id SET NOT NULL")

    # Elimina la tabella assignments
    op.execute("DROP INDEX IF EXISTS uq_mda_inventory_def")
    op.execute("DROP INDEX IF EXISTS uq_mda_type_def")
    op.execute("DROP INDEX IF EXISTS uq_mda_global_def")
    op.drop_table('metadata_definition_assignments')
