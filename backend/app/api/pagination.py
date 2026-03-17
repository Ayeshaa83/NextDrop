"""
Pagination utilities for API responses.

Provides standardized pagination with metadata including:
- Total item count
- Current page info
- Next/previous page indicators
"""
from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel, Field
from fastapi import Query

T = TypeVar('T')


class PaginationParams:
    """
    Dependency for pagination parameters.
    
    Usage:
        @router.get("/items")
        def list_items(pagination: PaginationParams = Depends()):
            return crud.get_items(skip=pagination.skip, limit=pagination.limit)
    """
    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of items to skip"),
        limit: int = Query(50, ge=1, le=100, description="Maximum items to return (max 100)")
    ):
        self.skip = skip
        self.limit = limit
    
    @property
    def page(self) -> int:
        """Calculate current page number (1-indexed)."""
        return (self.skip // self.limit) + 1


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response wrapper.
    
    Includes items plus pagination metadata.
    """
    items: List[T]
    total: int = Field(..., description="Total number of items")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Maximum items per page")
    has_more: bool = Field(..., description="Whether more items exist")
    
    @property
    def page(self) -> int:
        """Current page number (1-indexed)."""
        return (self.skip // self.limit) + 1 if self.limit > 0 else 1
    
    @property
    def total_pages(self) -> int:
        """Total number of pages."""
        return (self.total + self.limit - 1) // self.limit if self.limit > 0 else 1

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [],
                "total": 100,
                "skip": 0,
                "limit": 50,
                "has_more": True
            }
        }
    }


def paginate(
    items: List[T],
    total: int,
    skip: int,
    limit: int
) -> PaginatedResponse[T]:
    """
    Create a paginated response from items list.
    
    Args:
        items: The items for the current page
        total: Total count of all items (not just current page)
        skip: Number of items skipped
        limit: Maximum items per page
    
    Returns:
        PaginatedResponse with items and metadata
    """
    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total
    )


# Convenience type aliases for common paginated responses
class PaginationMeta(BaseModel):
    """Pagination metadata only (for embedding in custom responses)."""
    total: int
    skip: int
    limit: int
    has_more: bool
    page: int
    total_pages: int
