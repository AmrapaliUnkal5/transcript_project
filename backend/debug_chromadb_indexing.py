#!/usr/bin/env python3
"""
ChromaDB Indexing Debug Script

This script helps diagnose ChromaDB indexing issues where newly added documents
don't appear in top search results.
"""

import sys
import os
import time
import numpy as np

# Add the backend directory to the path
sys.path.append(os.path.dirname(__file__))

from app.vector_db import (
    get_chroma_client, 
    normalize_embedding, 
    add_document, 
    retrieve_similar_docs,
    add_documents_batch
)

def test_chromadb_indexing_issue(bot_id: int = 999):
    """Test for ChromaDB indexing issues with newly added documents."""
    print("=== ChromaDB Indexing Issue Diagnostic ===\n")
    
    try:
        # Create a test collection
        chroma_client = get_chroma_client()
        collection_name = f"debug_bot_{bot_id}_test"
        
        # Clean up any existing test collection
        try:
            chroma_client.delete_collection(collection_name)
            print(f"Cleaned up existing test collection: {collection_name}")
        except:
            pass
        
        # Test 1: Add first document
        print("Test 1: Adding first document...")
        first_doc_metadata = {
            "id": "test_doc_1",
            "source": "test",
            "file_name": "first_document.txt"
        }
        
        add_document(
            bot_id=bot_id,
            text="This is about artificial intelligence and machine learning algorithms.",
            metadata=first_doc_metadata,
            force_model="text-embedding-3-small"
        )
        
        # Wait a moment
        time.sleep(1)
        
        # Test query on first document
        print("Testing search with one document...")
        results_1 = retrieve_similar_docs(
            bot_id=bot_id,
            query_text="artificial intelligence",
            top_k=3
        )
        
        print(f"Results with 1 document: {len(results_1)} found")
        for i, result in enumerate(results_1):
            print(f"  {i+1}. Score: {result['score']:.4f}, ID: {result['metadata'].get('id', 'unknown')}")
        
        print()
        
        # Test 2: Add second document (this should be more relevant)
        print("Test 2: Adding second document (more relevant)...")
        second_doc_metadata = {
            "id": "test_doc_2", 
            "source": "test",
            "file_name": "second_document.txt"
        }
        
        add_document(
            bot_id=bot_id,
            text="Artificial intelligence is revolutionizing modern technology and AI systems.",
            metadata=second_doc_metadata,
            force_model="text-embedding-3-small"
        )
        
        # Wait a moment
        time.sleep(1)
        
        # Test query after second document
        print("Testing search with two documents...")
        results_2 = retrieve_similar_docs(
            bot_id=bot_id,
            query_text="artificial intelligence",
            top_k=3
        )
        
        print(f"Results with 2 documents: {len(results_2)} found")
        for i, result in enumerate(results_2):
            print(f"  {i+1}. Score: {result['score']:.4f}, ID: {result['metadata'].get('id', 'unknown')}")
        
        print()
        
        # Test 3: Add third document using batch method
        print("Test 3: Adding third document using batch method...")
        third_doc_data = [{
            "text": "The latest AI research focuses on artificial intelligence breakthroughs.",
            "metadata": {
                "id": "test_doc_3",
                "source": "test", 
                "file_name": "third_document.txt"
            }
        }]
        
        add_documents_batch(
            bot_id=bot_id,
            documents_data=third_doc_data,
            force_model="text-embedding-3-small"
        )
        
        # Wait a moment
        time.sleep(1)
        
        # Test query after third document
        print("Testing search with three documents...")
        results_3 = retrieve_similar_docs(
            bot_id=bot_id,
            query_text="artificial intelligence",
            top_k=3
        )
        
        print(f"Results with 3 documents: {len(results_3)} found")
        for i, result in enumerate(results_3):
            print(f"  {i+1}. Score: {result['score']:.4f}, ID: {result['metadata'].get('id', 'unknown')}")
        
        print()
        
        # Test 4: Check collection state directly
        print("Test 4: Direct collection inspection...")
        try:
            collection = chroma_client.get_collection(collection_name)
            total_docs = collection.count()
            
            # Get all documents
            all_docs = collection.get(include=["documents", "metadatas", "embeddings"])
            
            print(f"Total documents in collection: {total_docs}")
            print(f"Document IDs: {all_docs['ids']}")
            
            # Test a query directly on the collection
            if all_docs['embeddings'] and len(all_docs['embeddings']) > 0:
                test_embedding = normalize_embedding(all_docs['embeddings'][0])
                direct_results = collection.query(
                    query_embeddings=[test_embedding],
                    n_results=total_docs,
                    include=["documents", "metadatas", "distances"]
                )
                
                print("Direct collection query results:")
                for i, (doc_id, distance) in enumerate(zip(direct_results['ids'][0], direct_results['distances'][0])):
                    score = 1.0 - (distance / 2.0) if distance <= 2.0 else max(0.0, 1.0 - distance)
                    print(f"  {i+1}. ID: {doc_id}, Distance: {distance:.4f}, Score: {score:.4f}")
        
        except Exception as e:
            print(f"Error in direct collection inspection: {str(e)}")
        
        print()
        
        # Analysis
        print("=== ANALYSIS ===")
        
        # Check if the most relevant document (doc_2 or doc_3) appears first
        if len(results_3) >= 2:
            top_result_id = results_3[0]['metadata'].get('id')
            if top_result_id in ['test_doc_2', 'test_doc_3']:
                print("✅ SUCCESS: Most relevant document appears first!")
                print("   The indexing issue has been resolved.")
            else:
                print("❌ ISSUE DETECTED: Less relevant document appears first")
                print("   This indicates the ChromaDB indexing problem persists.")
                
                # Additional debugging
                print("\nAdditional debugging info:")
                print("Expected behavior: doc_2 or doc_3 should rank highest")
                print("Actual ranking order:")
                for i, result in enumerate(results_3):
                    doc_id = result['metadata'].get('id')
                    score = result['score']
                    print(f"  {i+1}. {doc_id} (score: {score:.4f})")
        else:
            print("❌ ERROR: Not enough results returned")
        
        # Cleanup
        try:
            chroma_client.delete_collection(collection_name)
            print(f"\n🧹 Cleaned up test collection: {collection_name}")
        except:
            pass
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("ChromaDB Indexing Issue Diagnostic Tool")
    print("=" * 50)
    
    # Test with a dedicated bot ID
    test_chromadb_indexing_issue(bot_id=999)
    
    print("\n" + "=" * 50)
    print("Diagnostic completed!")
    print("\nIf you see 'SUCCESS', the indexing issue is resolved.")
    print("If you see 'ISSUE DETECTED', try the additional solutions below:")
    print("1. Use batch operations instead of individual document additions")
    print("2. Configure HNSW parameters when creating collections")
    print("3. Force index refresh after document additions")
    print("4. Consider using upsert() instead of add() for updates") 