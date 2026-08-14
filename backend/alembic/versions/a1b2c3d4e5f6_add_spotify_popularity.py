"""add spotify_popularity to track_analytics

Revision ID: a1b2c3d4e5f6
Revises: ae60a1535239
Create Date: 2026-08-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ae60a1535239'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('track_analytics', sa.Column('spotify_popularity', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('track_analytics', 'spotify_popularity')
