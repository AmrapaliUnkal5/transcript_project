#!/usr/bin/env python3
"""
Utility script to enable quantization for existing Qdrant collections.

This script will:
1. Connect to your Qdrant instance
2. Enable scalar quantization for the unified_vector_store collection
3. Provide 4x memory reduction and up to 2x speed improvement

Usage:
    python enable_quantization.py
"""

import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.vector_db import enable_quantization_for_existing_collection
from app.utils.logger import get_module_logger

logger = get_module_logger(__name__)

def main():
    """Main function to enable quantization for existing collections."""
    print("🚀 Starting Qdrant Quantization Setup...")
    print("This will enable scalar quantization for your Qdrant collections.")
    print("Benefits:")
    print("  • 4x memory usage reduction")
    print("  • Up to 2x faster search speed")
    print("  • 99% accuracy retention")
    print()
    
    # Enable quantization for the main collection
    collection_name = "unified_vector_store"
    print(f"Enabling quantization for collection: {collection_name}")
    
    success = enable_quantization_for_existing_collection(collection_name)
    
    if success:
        print(f"✅ Successfully enabled quantization for {collection_name}")
        print()
        print("Quantization settings applied:")
        print("  • Type: Scalar (INT8)")
        print("  • Quantile: 0.99 (excludes 1% extreme values)")
        print("  • Memory mode: Always RAM (fastest performance)")
        print()
        print("Your Qdrant collection is now optimized! 🎉")
    else:
        print(f"❌ Failed to enable quantization for {collection_name}")
        print("Please check the logs for more details.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 