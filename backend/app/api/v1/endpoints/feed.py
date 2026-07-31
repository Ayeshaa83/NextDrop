"""
Social Feed API
Handles social posts (Jam Jar/Open Verse), comments, likes, and feed retrieval.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional, List

from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.models import User, Artist, Track, SocialPost, Comment, PostLike, Collaboration, PostType, CollaborationStatus, NotificationType
from app.crud import artist as artist_crud
from app.services import notification_service


router = APIRouter()


# ============ SCHEMAS ============

class TrackInfo(BaseModel):
    """Track info embedded in post response."""
    id: int
    title: str
    file_url: str
    duration: int
    genre: Optional[str] = None
    bpm: Optional[int] = None
    key: Optional[str] = None  # From ai_analysis
    
    class Config:
        from_attributes = True


class ArtistInfo(BaseModel):
    """Artist info embedded in post response."""
    id: int
    stage_name: str
    profile_picture: Optional[str] = None
    
    class Config:
        from_attributes = True


class CommentResponse(BaseModel):
    """Comment response schema."""
    id: int
    post_id: int
    artist: ArtistInfo
    text: str
    created_at: datetime

    class Config:
        from_attributes = True


class LikerResponse(BaseModel):
    """One artist who liked a post — for the 'liked by' list."""
    artist: ArtistInfo
    created_at: datetime

    class Config:
        from_attributes = True


class SocialPostResponse(BaseModel):
    """Full social post response with artist and track data."""
    id: int
    artist: ArtistInfo
    track: Optional[TrackInfo] = None
    content: str
    post_type: str
    like_count: int
    comment_count: int
    created_at: datetime
    is_liked: bool = False  # Whether current user has liked
    comments: List[CommentResponse] = []  # Recent comments (optional)
    # The viewer's own collaboration request against this post, if any —
    # lets the frontend show "Request Sent" / "Chat" instead of resetting
    # to a fresh "Collab" button on every reload.
    my_collab_id: Optional[int] = None
    my_collab_status: Optional[str] = None

    class Config:
        from_attributes = True


class CreatePostRequest(BaseModel):
    """Request to create a new social post."""
    content: str = Field(..., min_length=1, max_length=2000)
    post_type: str = Field(default="general", pattern="^(snippet|open_verse|general)$")
    track_id: Optional[int] = None


class CreateCommentRequest(BaseModel):
    """Request to create a comment."""
    text: str = Field(..., min_length=1, max_length=1000)


class CollabRequestCreate(BaseModel):
    """Request to create a collaboration from a post."""
    message: Optional[str] = Field(None, max_length=500)


# ============ HELPERS ============

def get_current_artist(db: Session, current_user: User) -> Artist:
    """Helper to get current user's artist profile."""
    artist = artist_crud.get_artist_by_user_id(db, user_id=current_user.id)
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You need an artist profile to use social features."
        )
    return artist


def track_to_info(track: Track) -> TrackInfo:
    """Convert Track model to TrackInfo schema."""
    # Extract key from ai_analysis if available
    key = None
    if track.ai_analysis and isinstance(track.ai_analysis, dict):
        key = track.ai_analysis.get("key")
    
    return TrackInfo(
        id=track.id,
        title=track.title,
        file_url=track.file_url,
        duration=track.duration,
        genre=track.genre,
        bpm=track.bpm,
        key=key,
    )


def artist_to_info(artist: Artist) -> ArtistInfo:
    """Convert Artist model to ArtistInfo schema."""
    return ArtistInfo(
        id=artist.id,
        stage_name=artist.stage_name,
        profile_picture=artist.profile_picture,
    )


def post_to_response(
    post: SocialPost,
    current_artist_id: Optional[int] = None,
    include_comments: bool = False,
    my_collab: Optional[tuple[int, str]] = None,
) -> SocialPostResponse:
    """Convert SocialPost model to response schema."""
    # Check if current user has liked
    is_liked = False
    if current_artist_id:
        is_liked = any(like.artist_id == current_artist_id for like in post.likes)

    # Get recent comments if requested
    comments = []
    if include_comments and post.comments:
        recent_comments = sorted(post.comments, key=lambda c: c.created_at, reverse=True)[:5]
        comments = [
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                artist=artist_to_info(c.artist),
                text=c.text,
                created_at=c.created_at,
            )
            for c in recent_comments
        ]

    return SocialPostResponse(
        id=post.id,
        artist=artist_to_info(post.artist),
        track=track_to_info(post.track) if post.track else None,
        content=post.content,
        post_type=post.post_type,
        like_count=post.like_count,
        comment_count=post.comment_count,
        created_at=post.created_at,
        is_liked=is_liked,
        comments=comments,
        my_collab_id=my_collab[0] if my_collab else None,
        my_collab_status=my_collab[1] if my_collab else None,
    )


def _my_collab_by_post(db: Session, artist_id: int, post_ids: list[int]) -> dict[int, tuple[int, str]]:
    """Map post_id -> (collaboration_id, status) for collab requests the
    current artist has sent from these posts. Latest one wins per post."""
    if not post_ids:
        return {}
    rows = (
        db.query(Collaboration)
        .filter(
            Collaboration.initiator_id == artist_id,
            Collaboration.post_id.in_(post_ids),
        )
        .order_by(Collaboration.created_at.desc())
        .all()
    )
    result: dict[int, tuple[int, str]] = {}
    for row in rows:
        result.setdefault(row.post_id, (row.id, row.status))
    return result


# ============ ENDPOINTS ============

@router.post("/posts", response_model=SocialPostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_data: CreatePostRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Create a new social post.
    
    If track_id is provided, automatically includes the track's file_url, BPM, and key.
    """
    artist = get_current_artist(db, current_user)
    
    # Validate track if provided
    track = None
    if post_data.track_id:
        track = db.query(Track).filter(
            Track.id == post_data.track_id,
            Track.artist_id == artist.id  # Must own the track
        ).first()
        
        if not track:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Track not found or you don't own this track"
            )
    
    # Create the post
    new_post = SocialPost(
        artist_id=artist.id,
        track_id=post_data.track_id,
        content=post_data.content,
        post_type=post_data.post_type,
        like_count=0,
        comment_count=0,
    )
    
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    
    # Reload with relationships
    new_post = db.query(SocialPost).options(
        joinedload(SocialPost.artist),
        joinedload(SocialPost.track),
        joinedload(SocialPost.likes),
    ).filter(SocialPost.id == new_post.id).first()
    
    return post_to_response(new_post, artist.id)


@router.get("/feed", response_model=PaginatedResponse[SocialPostResponse])
def get_feed(
    pagination: PaginationParams = Depends(),
    post_type: Optional[str] = Query(None, pattern="^(snippet|open_verse|general)$", description="Filter by post type"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get the social feed with posts from all artists.
    
    Returns paginated posts with artist info, track data (including BPM/key), and like status.
    """
    artist = get_current_artist(db, current_user)
    
    # Build query with eager loading
    query = db.query(SocialPost).options(
        joinedload(SocialPost.artist),
        joinedload(SocialPost.track),
        joinedload(SocialPost.likes),
        joinedload(SocialPost.comments).joinedload(Comment.artist),
    )
    
    # Filter by post type
    if post_type:
        query = query.filter(SocialPost.post_type == post_type)
    
    # Order by newest first
    query = query.order_by(desc(SocialPost.created_at))
    
    # Get total count
    total = query.count()
    
    # Paginate
    posts = query.offset(pagination.skip).limit(pagination.limit).all()

    # Convert to response
    collab_by_post = _my_collab_by_post(db, artist.id, [p.id for p in posts])
    items = [
        post_to_response(post, artist.id, include_comments=True, my_collab=collab_by_post.get(post.id))
        for post in posts
    ]

    return paginate(items, total, pagination.skip, pagination.limit)


@router.get("/posts/{post_id}", response_model=SocialPostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get a single post with all details."""
    artist = get_current_artist(db, current_user)
    
    post = db.query(SocialPost).options(
        joinedload(SocialPost.artist),
        joinedload(SocialPost.track),
        joinedload(SocialPost.likes),
        joinedload(SocialPost.comments).joinedload(Comment.artist),
    ).filter(SocialPost.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    my_collab = _my_collab_by_post(db, artist.id, [post.id]).get(post.id)
    return post_to_response(post, artist.id, include_comments=True, my_collab=my_collab)


@router.post("/posts/{post_id}/like", status_code=status.HTTP_200_OK)
def like_post(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Like/Hype a post. Toggles the like (like if not liked, unlike if already liked).
    """
    artist = get_current_artist(db, current_user)
    
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    
    # Check if already liked
    existing_like = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.artist_id == artist.id
    ).first()
    
    if existing_like:
        # Unlike
        db.delete(existing_like)
        post.like_count = max(0, post.like_count - 1)
        action = "unliked"
    else:
        # Like
        new_like = PostLike(post_id=post_id, artist_id=artist.id)
        db.add(new_like)
        post.like_count += 1
        action = "liked"
    
    db.commit()
    
    return {"message": f"Post {action}", "like_count": post.like_count, "is_liked": action == "liked"}


@router.post("/posts/{post_id}/comment", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def comment_on_post(
    post_id: int,
    comment_data: CreateCommentRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Add a comment to a post."""
    artist = get_current_artist(db, current_user)
    
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    
    new_comment = Comment(
        post_id=post_id,
        artist_id=artist.id,
        text=comment_data.text,
    )
    
    db.add(new_comment)
    post.comment_count += 1
    db.commit()
    db.refresh(new_comment)
    
    return CommentResponse(
        id=new_comment.id,
        post_id=new_comment.post_id,
        artist=artist_to_info(artist),
        text=new_comment.text,
        created_at=new_comment.created_at,
    )


@router.get("/posts/{post_id}/comments", response_model=PaginatedResponse[CommentResponse])
def get_post_comments(
    post_id: int,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all comments for a post with pagination."""
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    
    query = db.query(Comment).options(
        joinedload(Comment.artist)
    ).filter(Comment.post_id == post_id).order_by(desc(Comment.created_at))
    
    total = query.count()
    comments = query.offset(pagination.skip).limit(pagination.limit).all()
    
    items = [
        CommentResponse(
            id=c.id,
            post_id=c.post_id,
            artist=artist_to_info(c.artist),
            text=c.text,
            created_at=c.created_at,
        )
        for c in comments
    ]
    
    return paginate(items, total, pagination.skip, pagination.limit)


@router.get("/posts/{post_id}/likes", response_model=PaginatedResponse[LikerResponse])
def get_post_likes(
    post_id: int,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get the artists who liked a post, most recent first."""
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    query = db.query(PostLike).options(
        joinedload(PostLike.artist)
    ).filter(PostLike.post_id == post_id).order_by(desc(PostLike.created_at))

    total = query.count()
    likes = query.offset(pagination.skip).limit(pagination.limit).all()

    items = [
        LikerResponse(artist=artist_to_info(l.artist), created_at=l.created_at)
        for l in likes
    ]

    return paginate(items, total, pagination.skip, pagination.limit)


@router.post("/posts/{post_id}/collab-request", status_code=status.HTTP_201_CREATED)
def create_collab_request(
    post_id: int,
    request_data: CollabRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Send a collaboration request based on a post (e.g., Open Verse or Jam Jar).
    
    Creates a Collaboration record between the post owner and the requester,
    referencing the track if the post has one.
    """
    artist = get_current_artist(db, current_user)
    
    # Get the post
    post = db.query(SocialPost).options(
        joinedload(SocialPost.artist),
        joinedload(SocialPost.track),
    ).filter(SocialPost.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    
    # Can't collab with yourself
    if post.artist_id == artist.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="You cannot request collaboration on your own post"
        )
    
    # Check for existing pending request
    existing = db.query(Collaboration).filter(
        Collaboration.initiator_id == artist.id,
        Collaboration.collaborator_id == post.artist_id,
        Collaboration.post_id == post_id,
        Collaboration.status == CollaborationStatus.PENDING.value
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending collaboration request for this post"
        )
    
    # Create collaboration request
    new_collab = Collaboration(
        initiator_id=artist.id,
        collaborator_id=post.artist_id,
        track_id=post.track_id,
        post_id=post_id,
        status=CollaborationStatus.PENDING.value,
        message=request_data.message,
    )
    
    db.add(new_collab)
    db.commit()
    db.refresh(new_collab)

    notification_service.create(
        db, post.artist.user_id,
        NotificationType.COLLAB_REQUEST,
        title=f"{artist.stage_name} wants to collaborate",
        body=request_data.message or "Check out their request in Collabs.",
        link="/collabs",
    )

    return {
        "message": "Collaboration request sent",
        "collaboration_id": new_collab.id,
        "to_artist": post.artist.stage_name,
        "track_title": post.track.title if post.track else None,
    }


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Delete a post. Only the post owner can delete."""
    artist = get_current_artist(db, current_user)
    
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    
    if post.artist_id != artist.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own posts")
    
    db.delete(post)
    db.commit()
    
    return {"message": "Post deleted successfully"}
