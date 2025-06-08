#!/usr/bin/env python3
"""
ChromaDB Debug Script
This script helps debug ChromaDB issues on AWS servers or other environments.
Run this script to identify potential issues with permissions, client initialization, and collection access.
"""

import os
import sys
import time
import chromadb
from pathlib import Path
import traceback
import logging
from app.config import settings

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_directory_permissions():
    """Check directory permissions for ChromaDB storage."""
    print("\n=== DIRECTORY PERMISSIONS CHECK ===")
    
    chroma_dir = f"./{settings.CHROMA_DIR}"
    abs_chroma_dir = os.path.abspath(chroma_dir)
    
    print(f"ChromaDB directory (relative): {chroma_dir}")
    print(f"ChromaDB directory (absolute): {abs_chroma_dir}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script location: {os.path.dirname(os.path.abspath(__file__))}")
    
    # Check if directory exists
    if os.path.exists(abs_chroma_dir):
        print(f"✓ Directory exists: {abs_chroma_dir}")
        
        # Check permissions
        try:
            print(f"✓ Directory is readable: {os.access(abs_chroma_dir, os.R_OK)}")
            print(f"✓ Directory is writable: {os.access(abs_chroma_dir, os.W_OK)}")
            print(f"✓ Directory is executable: {os.access(abs_chroma_dir, os.X_OK)}")
            
            # List contents
            contents = os.listdir(abs_chroma_dir)
            print(f"✓ Directory contents ({len(contents)} items): {contents[:10]}{'...' if len(contents) > 10 else ''}")
            
            # Check file permissions for some contents
            for item in contents[:5]:  # Check first 5 items
                item_path = os.path.join(abs_chroma_dir, item)
                if os.path.isfile(item_path):
                    print(f"  File {item}: R={os.access(item_path, os.R_OK)}, W={os.access(item_path, os.W_OK)}")
                elif os.path.isdir(item_path):
                    print(f"  Dir {item}: R={os.access(item_path, os.R_OK)}, W={os.access(item_path, os.W_OK)}, X={os.access(item_path, os.X_OK)}")
            
        except Exception as e:
            print(f"✗ Error checking directory permissions: {e}")
    else:
        print(f"✗ Directory does not exist: {abs_chroma_dir}")
        
        # Try to create it
        try:
            os.makedirs(abs_chroma_dir, exist_ok=True)
            print(f"✓ Successfully created directory: {abs_chroma_dir}")
        except Exception as e:
            print(f"✗ Failed to create directory: {e}")

def test_chroma_client_init():
    """Test ChromaDB client initialization."""
    print("\n=== CHROMA CLIENT INITIALIZATION ===")
    
    try:
        chroma_dir = f"./{settings.CHROMA_DIR}"
        print(f"Attempting to initialize ChromaDB client with path: {chroma_dir}")
        
        start_time = time.time()
        client = chromadb.PersistentClient(path=chroma_dir)
        init_time = time.time() - start_time
        
        print(f"✓ ChromaDB client initialized successfully in {init_time:.2f} seconds")
        return client
        
    except Exception as e:
        print(f"✗ Failed to initialize ChromaDB client: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        return None

def test_collection_listing(client):
    """Test listing collections."""
    print("\n=== COLLECTION LISTING TEST ===")
    
    if not client:
        print("✗ No client available for testing")
        return []
    
    try:
        start_time = time.time()
        collections = client.list_collections()
        list_time = time.time() - start_time
        
        print(f"✓ Successfully listed collections in {list_time:.2f} seconds")
        print(f"Found {len(collections)} collections")
        
        # Determine API version
        if collections and len(collections) > 0:
            if isinstance(collections[0], str):
                print("✓ Using new ChromaDB API (v0.6.0+)")
                collection_names = collections
            else:
                print("✓ Using old ChromaDB API (pre-0.6.0)")
                collection_names = [col.name for col in collections]
        else:
            collection_names = []
            
        for i, name in enumerate(collection_names[:10]):  # Show first 10
            print(f"  {i+1}. {name}")
        
        if len(collection_names) > 10:
            print(f"  ... and {len(collection_names) - 10} more")
            
        return collection_names
        
    except Exception as e:
        print(f"✗ Failed to list collections: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        return []

def test_collection_access(client, collection_names):
    """Test accessing individual collections."""
    print("\n=== COLLECTION ACCESS TEST ===")
    
    if not client:
        print("✗ No client available for testing")
        return
    
    if not collection_names:
        print("✗ No collections to test")
        return
    
    # Test first few collections
    test_collections = collection_names[:3]
    
    for collection_name in test_collections:
        print(f"\nTesting collection: {collection_name}")
        
        try:
            start_time = time.time()
            collection = client.get_collection(name=collection_name)
            access_time = time.time() - start_time
            
            print(f"  ✓ Successfully accessed collection in {access_time:.2f} seconds")
            
            # Get collection info
            try:
                count = collection.count()
                print(f"  ✓ Collection has {count} documents")
                
                if count > 0:
                    # Try to get a few documents
                    try:
                        sample = collection.get(limit=3, include=["metadatas", "documents"])
                        print(f"  ✓ Successfully retrieved sample data ({len(sample.get('ids', []))} items)")
                    except Exception as e:
                        print(f"  ! Warning: Could not retrieve sample data: {e}")
                        
            except Exception as e:
                print(f"  ! Warning: Could not get collection count: {e}")
                
        except Exception as e:
            print(f"  ✗ Failed to access collection: {e}")
            if "timeout" in str(e).lower():
                print("  → This looks like a timeout issue")
            elif "permission" in str(e).lower():
                print("  → This looks like a permission issue")
            elif "lock" in str(e).lower():
                print("  → This looks like a file lock issue")

def test_basic_operations(client):
    """Test basic ChromaDB operations."""
    print("\n=== BASIC OPERATIONS TEST ===")
    
    if not client:
        print("✗ No client available for testing")
        return
    
    test_collection_name = "debug_test_collection"
    
    try:
        # Try to create a test collection
        print(f"Creating test collection: {test_collection_name}")
        
        start_time = time.time()
        test_collection = client.create_collection(name=test_collection_name)
        create_time = time.time() - start_time
        
        print(f"✓ Test collection created in {create_time:.2f} seconds")
        
        # Try to add a document
        print("Adding test document...")
        start_time = time.time()
        test_collection.add(
            ids=["test_doc_1"],
            documents=["This is a test document for debugging"],
            metadatas=[{"source": "debug_test"}]
        )
        add_time = time.time() - start_time
        print(f"✓ Test document added in {add_time:.2f} seconds")
        
        # Try to query
        print("Querying test collection...")
        start_time = time.time()
        results = test_collection.query(
            query_texts=["test document"],
            n_results=1
        )
        query_time = time.time() - start_time
        print(f"✓ Query completed in {query_time:.2f} seconds")
        print(f"✓ Found {len(results.get('documents', [[]])[0])} results")
        
        # Clean up
        print("Cleaning up test collection...")
        client.delete_collection(name=test_collection_name)
        print("✓ Test collection deleted")
        
    except Exception as e:
        print(f"✗ Basic operations test failed: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        
        # Try to clean up if collection was created
        try:
            client.delete_collection(name=test_collection_name)
            print("✓ Cleanup: Test collection deleted")
        except:
            pass

def check_system_resources():
    """Check system resources that might affect ChromaDB."""
    print("\n=== SYSTEM RESOURCES CHECK ===")
    
    try:
        import psutil
        
        # Memory usage
        memory = psutil.virtual_memory()
        print(f"Memory usage: {memory.percent}% ({memory.used // (1024**3):.1f}GB used / {memory.total // (1024**3):.1f}GB total)")
        
        # Disk usage
        chroma_dir = f"./{settings.CHROMA_DIR}"
        disk = psutil.disk_usage(os.path.dirname(os.path.abspath(chroma_dir)))
        print(f"Disk usage: {disk.percent}% ({disk.used // (1024**3):.1f}GB used / {disk.total // (1024**3):.1f}GB total)")
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        print(f"CPU usage: {cpu_percent}%")
        
    except ImportError:
        print("psutil not available, skipping system resource check")
        print("Install with: pip install psutil")
    except Exception as e:
        print(f"Error checking system resources: {e}")

def main():
    """Main debugging function."""
    print("ChromaDB Debug Script")
    print("=" * 50)
    
    print(f"Python version: {sys.version}")
    print(f"ChromaDB version: {chromadb.__version__}")
    print(f"Settings CHROMA_DIR: {settings.CHROMA_DIR}")
    
    # Run all checks
    check_directory_permissions()
    check_system_resources()
    
    client = test_chroma_client_init()
    collection_names = test_collection_listing(client)
    test_collection_access(client, collection_names)
    test_basic_operations(client)
    
    print("\n=== SUMMARY ===")
    print("Debug script completed. Check the output above for any issues.")
    print("If you're still having problems, please share this output for further diagnosis.")

if __name__ == "__main__":
    main() 