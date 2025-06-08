#!/usr/bin/env python3
"""
Simple script to check what ChromaDB collections exist.
"""

import sys
import os
import chromadb

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings

def main():
    print("ChromaDB Collections Checker")
    print("=" * 40)
    
    try:
        # Initialize ChromaDB client
        chroma_dir = f"./{settings.CHROMA_DIR}"
        print(f"ChromaDB directory: {chroma_dir}")
        
        client = chromadb.PersistentClient(path=chroma_dir)
        print("✓ ChromaDB client initialized successfully")
        
        # List all collections
        collections = client.list_collections()
        print(f"\nFound {len(collections)} collections:")
        
        if not collections:
            print("  (No collections found)")
        else:
            # Determine API version and get collection names
            if isinstance(collections[0], str):
                collection_names = collections
            else:
                collection_names = [col.name for col in collections]
            
            for i, name in enumerate(collection_names, 1):
                print(f"  {i}. {name}")
                
                # Try to get collection info
                try:
                    collection = client.get_collection(name=name)
                    count = collection.count()
                    print(f"     └─ Documents: {count}")
                except Exception as e:
                    print(f"     └─ Error accessing collection: {e}")
        
        # Check for the specific collection mentioned in logs
        target_collection = "bot_26_text_embedding_3_small"
        print(f"\nChecking for specific collection: {target_collection}")
        
        if isinstance(collections[0], str) if collections else True:
            collection_names = collections
        else:
            collection_names = [col.name for col in collections]
            
        if target_collection in collection_names:
            print(f"✓ Collection '{target_collection}' exists")
            try:
                collection = client.get_collection(name=target_collection)
                count = collection.count()
                print(f"  Documents: {count}")
            except Exception as e:
                print(f"  Error accessing: {e}")
        else:
            print(f"✗ Collection '{target_collection}' does NOT exist")
            
            # Look for similar collections
            similar = [name for name in collection_names if "bot_26" in name]
            if similar:
                print(f"  Similar collections found: {similar}")
            else:
                print("  No similar collections found")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 