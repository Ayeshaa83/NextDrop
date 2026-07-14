"""add analytics_snapshots table (daily per-platform stream deltas)

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'analytics_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('track_id', sa.Integer(), nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('streams', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('country', sa.String(length=2), nullable=True),
        sa.ForeignKeyConstraint(['track_id'], ['tracks.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analytics_snapshots_id'), 'analytics_snapshots', ['id'], unique=False)
    op.create_index(op.f('ix_analytics_snapshots_track_id'), 'analytics_snapshots', ['track_id'], unique=False)
    op.create_index(op.f('ix_analytics_snapshots_platform'), 'analytics_snapshots', ['platform'], unique=False)
    op.create_index(op.f('ix_analytics_snapshots_snapshot_date'), 'analytics_snapshots', ['snapshot_date'], unique=False)
    op.create_index(op.f('ix_analytics_snapshots_country'), 'analytics_snapshots', ['country'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_analytics_snapshots_country'), table_name='analytics_snapshots')
    op.drop_index(op.f('ix_analytics_snapshots_snapshot_date'), table_name='analytics_snapshots')
    op.drop_index(op.f('ix_analytics_snapshots_platform'), table_name='analytics_snapshots')
    op.drop_index(op.f('ix_analytics_snapshots_track_id'), table_name='analytics_snapshots')
    op.drop_index(op.f('ix_analytics_snapshots_id'), table_name='analytics_snapshots')
    op.drop_table('analytics_snapshots')
