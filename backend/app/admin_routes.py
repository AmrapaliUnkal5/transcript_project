from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Addon
from app.dependency import get_current_user
import os

router = APIRouter(prefix="/admin", tags=["Admin"])

# Add new endpoint to fix addon codes
@router.get("/fix-addon-codes", response_model=dict)
async def fix_addon_codes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate Zoho addon codes for addons that don't have them"""
    # Verify admin access
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    print("\n=== Fixing Addon Codes ===")
    result = {
        "updated": 0,
        "errors": []
    }
    
    # Verify that ZOHO_DEFAULT_PRODUCT_ID is set in environment
    default_product_id = os.getenv('ZOHO_DEFAULT_PRODUCT_ID')
    if not default_product_id:
        error_msg = "ZOHO_DEFAULT_PRODUCT_ID environment variable is not set!"
        print(f"ERROR: {error_msg}")
        return {"error": error_msg}
    
    print(f"Using default Zoho product ID: {default_product_id}")
    
    try:
        # Get all addons without Zoho codes
        addons = db.query(Addon).all()
        print(f"Found {len(addons)} total addons")
        
        for addon in addons:
            try:
                addon_needs_update = False
                addon_updates = []
                
                # Generate a code if not present (using a format that includes price for uniqueness)
                if not addon.zoho_addon_code:
                    addon.zoho_addon_code = f"ADDON_{addon.id}_{int(addon.price * 100)}"
                    addon_updates.append(f"code={addon.zoho_addon_code}")
                    addon_needs_update = True
                
                # Set product_id if not present
                if not addon.zoho_product_id:
                    addon.zoho_product_id = default_product_id
                    addon_updates.append(f"product_id={default_product_id}")
                    addon_needs_update = True
                
                # Set addon_type if not present
                if not addon.addon_type:
                    addon.addon_type = "one_time"
                    addon_updates.append(f"type=one_time")
                    addon_needs_update = True
                
                if addon_needs_update:
                    print(f"Updating addon {addon.id} - {addon.name}: {', '.join(addon_updates)}")
                    result["updated"] += 1
                else:
                    print(f"Addon {addon.id} - {addon.name} already properly configured")
                
            except Exception as e:
                error_msg = f"Error fixing addon {addon.id} - {addon.name}: {str(e)}"
                print(f"ERROR: {error_msg}")
                result["errors"].append(error_msg)
        
        # Commit changes
        db.commit()
        print(f"Successfully updated {result['updated']} addons")
        print("=== End Fixing Addon Codes ===\n")
        
        return result
    except Exception as e:
        db.rollback()
        error_msg = f"Error fixing addon codes: {str(e)}"
        print(f"ERROR: {error_msg}")
        result["errors"].append(error_msg)
        return result

# Endpoint to list all addons for debugging
@router.get("/list-addons", response_model=dict)
async def list_addons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all addons with their details for debugging"""
    # Verify admin access
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get all addons
        addons = db.query(Addon).all()
        addon_list = []
        
        for addon in addons:
            addon_list.append({
                "id": addon.id,
                "name": addon.name,
                "price": float(addon.price) if addon.price is not None else 0,
                "description": addon.description,
                "zoho_addon_id": addon.zoho_addon_id,
                "zoho_addon_code": addon.zoho_addon_code,
                "zoho_product_id": addon.zoho_product_id,
                "addon_type": addon.addon_type
            })
        
        return {
            "count": len(addon_list),
            "addons": addon_list
        }
    except Exception as e:
        error_msg = f"Error listing addons: {str(e)}"
        print(f"ERROR: {error_msg}")
        return {"error": error_msg} 