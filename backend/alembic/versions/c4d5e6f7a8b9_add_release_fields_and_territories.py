"""add release fields (cover art, isrc, explicit, release_date), collaborator display_name, distribution territories

Revision ID: c4d5e6f7a8b9
Revises: 38a0ad77e4d5
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = '38a0ad77e4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Track release metadata
    op.add_column('tracks', sa.Column('cover_art_url', sa.String(), nullable=True))
    op.add_column('tracks', sa.Column('isrc', sa.String(length=20), nullable=True))
    op.add_column('tracks', sa.Column('is_explicit', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('tracks', sa.Column('release_date', sa.DateTime(), nullable=True))

    # Split-sheet: allow external collaborators (name only, no account)
    op.add_column('track_collaborators', sa.Column('display_name', sa.String(length=100), nullable=True))
    op.alter_column('track_collaborators', 'user_id', existing_type=sa.Integer(), nullable=True)

    # Distribution territory selection (list of ISO country codes; null = worldwide)
    op.add_column('track_distributions', sa.Column('territories', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('track_distributions', 'territories')
    op.alter_column('track_collaborators', 'user_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('track_collaborators', 'display_name')
    op.drop_column('tracks', 'release_date')
    op.drop_column('tracks', 'is_explicit')
    op.drop_column('tracks', 'isrc')
    op.drop_column('tracks', 'cover_art_url')
