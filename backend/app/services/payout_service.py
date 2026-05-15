from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.music import Track, TrackCollaborator
from app.models.core import Wallet

def distribute_revenue(db: Session, track_id: int, total_amount: float):
    # 1. Validation check
    collaborators = db.query(TrackCollaborator).filter(TrackCollaborator.track_id == track_id).all()
    
    if not collaborators:
        raise HTTPException(status_code=400, detail="No collaborators found for this track. Please set up split sheets.")

    total_percentage = sum([c.royalty_percentage for c in collaborators])
    if abs(total_percentage - 100.0) > 0.01:  # Floating point tolerance
        raise HTTPException(
            status_code=400, 
            detail=f"Collaborator split sheets must equal exactly 100%. Current total: {total_percentage}%"
        )
    
    # 2. Payout Logic
    for collab in collaborators:
        # Get or create the wallet for the user
        wallet = db.query(Wallet).filter(Wallet.user_id == collab.user_id).first()
        if not wallet:
            wallet = Wallet(user_id=collab.user_id, balance=0.0)
            db.add(wallet)
            db.flush()
        
        # Calculate their cut
        cut = total_amount * (collab.royalty_percentage / 100.0)
        wallet.balance += cut
        
    db.commit()
    return {"message": f"Successfully distributed {total_amount} across {len(collaborators)} collaborators."}
