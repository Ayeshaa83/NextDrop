"""artist onboarding approval + admin-managed platform configs

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing artists are grandfathered in as approved; new signups default
    # to 'pending' via the model-level default.
    op.add_column('artists', sa.Column(
        'approval_status', sa.String(length=20),
        server_default='approved', nullable=False,
    ))
    op.add_column('artists', sa.Column('approval_reviewed_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_artists_approval_status'), 'artists', ['approval_status'], unique=False)

    op.create_table(
        'platform_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('platform_id', sa.String(length=50), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=300), nullable=False, server_default=''),
        sa.Column('color', sa.String(length=9), nullable=False, server_default='#888888'),
        sa.Column('category', sa.String(length=20), nullable=False, server_default='music'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('platform_id'),
    )
    op.create_index(op.f('ix_platform_configs_id'), 'platform_configs', ['id'], unique=False)
    op.create_index(op.f('ix_platform_configs_platform_id'), 'platform_configs', ['platform_id'], unique=True)

    # Seed the previous hardcoded "Coming Soon" list so admins can manage it
    platform_configs = sa.table(
        'platform_configs',
        sa.column('platform_id', sa.String),
        sa.column('display_name', sa.String),
        sa.column('description', sa.String),
        sa.column('color', sa.String),
        sa.column('category', sa.String),
        sa.column('enabled', sa.Boolean),
    )
    op.bulk_insert(platform_configs, [
        {"platform_id": "apple_music", "display_name": "Apple Music",
         "description": "Connect Apple Music for streaming analytics.",
         "color": "#FC3C44", "category": "music", "enabled": True},
        {"platform_id": "tiktok", "display_name": "TikTok",
         "description": "Track viral performance and short-form reach.",
         "color": "#69C9D0", "category": "social", "enabled": True},
        {"platform_id": "soundcloud", "display_name": "SoundCloud",
         "description": "Monitor plays and reposts on SoundCloud.",
         "color": "#FF5500", "category": "music", "enabled": True},
        {"platform_id": "instagram", "display_name": "Instagram",
         "description": "Measure reel reach and story engagement.",
         "color": "#E1306C", "category": "social", "enabled": True},
        {"platform_id": "twitch", "display_name": "Twitch",
         "description": "Live stream metrics and viewer analytics.",
         "color": "#9146FF", "category": "video", "enabled": True},
        {"platform_id": "twitter", "display_name": "X / Twitter",
         "description": "Track mentions, engagement, and follower growth.",
         "color": "#1DA1F2", "category": "social", "enabled": True},
    ])


def downgrade() -> None:
    op.drop_index(op.f('ix_platform_configs_platform_id'), table_name='platform_configs')
    op.drop_index(op.f('ix_platform_configs_id'), table_name='platform_configs')
    op.drop_table('platform_configs')
    op.drop_index(op.f('ix_artists_approval_status'), table_name='artists')
    op.drop_column('artists', 'approval_reviewed_at')
    op.drop_column('artists', 'approval_status')
