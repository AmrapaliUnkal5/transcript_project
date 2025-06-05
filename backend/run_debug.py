#!/usr/bin/env python3
"""
Script to run the ChromaDB debug tool.
Run this from the backend directory: python run_debug.py
"""

import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the debug script
from app.debug_chroma import main

if __name__ == "__main__":
    print("Starting ChromaDB Debug Tool...")
    print("Make sure you're running this from the backend directory!")
    print("=" * 60)
    main() 