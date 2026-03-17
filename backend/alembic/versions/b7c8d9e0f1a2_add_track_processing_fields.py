"""Add track processing fields

Revision ID: b7c8d9e0f1a2
Revises: a493e24159ca
Create Date: 2026-03-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a493e24159ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add processing_status column with default value
    op.add_column('tracks', sa.Column(
        'processing_status',
        sa.String(20),
        nullable=False,
        server_default='pending'
    ))
    
    # Add ai_analysis JSON column for Librosa results
    op.add_column('tracks', sa.Column(
        'ai_analysis',
        sa.JSON(),
        nullable=True
    ))
    
    # Add processing_error column for error messages
    op.add_column('tracks', sa.Column(
        'processing_error',
        sa.String(500),
        nullable=True
    ))
    
    # Create index on processing_status for efficient queries
    op.create_index(
        'ix_tracks_processing_status',
        'tracks',
        ['processing_status']
    )


def downgrade() -> None:
    # Drop index first
    op.drop_index('ix_tracks_processing_status', table_name='tracks')
    
    # Drop columns
    op.drop_column('tracks', 'processing_error')
    op.drop_column('tracks', 'ai_analysis')
    op.drop_column('tracks', 'processing_status')
