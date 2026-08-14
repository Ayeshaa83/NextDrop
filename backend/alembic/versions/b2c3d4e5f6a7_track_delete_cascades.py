"""add ondelete cascade/set null to tracks.id foreign keys

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-14

Enables deleting a track without a manual, easy-to-miss cascade in Python.
Confirmed by direct test that the previous DELETE /tracks/{id} endpoint
threw a FK IntegrityError on any track with related data — i.e. virtually
every real track in the app, since track_analytics is created for all of
them. CASCADE for data that only makes sense scoped to the track itself
(analytics, distributions, split sheets, album membership); SET NULL for
records that should outlive the track they reference (social posts,
collaboration chats — deleting a track shouldn't erase a JamJar post or a
collab conversation, just its track link).
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, constraint_name, ondelete)
_FKS = [
    ('album_tracks', 'album_tracks_track_id_fkey', 'CASCADE'),
    ('track_analytics', 'track_analytics_track_id_fkey', 'CASCADE'),
    ('analytics_snapshots', 'analytics_snapshots_track_id_fkey', 'CASCADE'),
    ('track_collaborators', 'track_collaborators_track_id_fkey', 'CASCADE'),
    ('track_distributions', 'track_distributions_track_id_fkey', 'CASCADE'),
    ('social_posts', 'social_posts_track_id_fkey', 'SET NULL'),
    ('collaborations', 'collaborations_track_id_fkey', 'SET NULL'),
]


def upgrade() -> None:
    for table, constraint, ondelete in _FKS:
        op.drop_constraint(constraint, table, type_='foreignkey')
        op.create_foreign_key(constraint, table, 'tracks', ['track_id'], ['id'], ondelete=ondelete)


def downgrade() -> None:
    for table, constraint, _ in _FKS:
        op.drop_constraint(constraint, table, type_='foreignkey')
        op.create_foreign_key(constraint, table, 'tracks', ['track_id'], ['id'])
