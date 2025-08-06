# Qdrant Quantization Setup

## Overview

Quantization has been enabled for your Qdrant vector database to provide significant performance improvements with minimal impact on search accuracy.

## Benefits

- **4x Memory Reduction**: Vectors are compressed from float32 to int8
- **Up to 2x Faster Search**: SIMD CPU instructions optimize vector comparisons
- **99% Accuracy Retention**: Minimal impact on search quality
- **Cost Savings**: Reduced memory usage lowers infrastructure costs

## Quantization Method: Scalar Quantization

We've implemented **Scalar Quantization** as it provides the best balance of:
- **Accuracy**: 0.99 (99% of original accuracy)
- **Speed**: Up to 2x performance improvement
- **Compression**: 4x memory reduction
- **Compatibility**: Works with all vector types and dimensions

## Configuration Details

```python
quantization_config=ScalarQuantization(
    scalar=ScalarQuantizationConfig(
        type=ScalarType.INT8,      # Compress float32 → uint8
        quantile=0.99,             # Exclude 1% extreme values
        always_ram=True,           # Keep quantized vectors in RAM for speed
    ),
)
```

### Parameters Explained

- **`type=INT8`**: Converts 32-bit floats to 8-bit integers
- **`quantile=0.99`**: Ignores 1% of extreme values to improve quantization bounds
- **`always_ram=True`**: Keeps quantized vectors in memory for fastest performance

## What's Changed

### 1. New Collections
All new Qdrant collections will automatically include quantization:

```python
# In vector_db.py - add_document_to_qdrant()
qdrant_client.create_collection(
    collection_name=collection_name,
    vectors_config=VectorParams(size=embedding_dimension, distance=Distance.COSINE),
    shard_number=4,
    quantization_config=ScalarQuantization(...)  # ← Quantization enabled
)
```

### 2. Existing Collections
Use the provided utility script to enable quantization for existing collections:

```bash
cd backend
python enable_quantization.py
```

### 3. Search Optimization
Quantization is automatically used during search operations. You can control it with search parameters:

```python
client.query_points(
    collection_name="unified_vector_store",
    query=query_vector,
    search_params=models.SearchParams(
        quantization=models.QuantizationSearchParams(
            ignore=False,     # Use quantization (default)
            rescore=True,     # Re-rank with original vectors (recommended)
            oversampling=2.0  # Pre-select 2x more results for rescoring
        )
    )
)
```

## Performance Tuning Options

### Memory Modes

1. **All in RAM** (Default - Fastest)
   ```python
   always_ram=True  # Quantized vectors in RAM
   on_disk=False    # Original vectors in RAM
   ```

2. **Hybrid Mode** (Balanced)
   ```python
   always_ram=True  # Quantized vectors in RAM
   on_disk=True     # Original vectors on disk
   ```

3. **All on Disk** (Most memory efficient)
   ```python
   always_ram=False  # Quantized vectors on disk
   on_disk=True      # Original vectors on disk
   ```

### Search Parameters

- **`rescore=True`**: Use original vectors to re-rank top results (recommended)
- **`oversampling=2.0`**: Fetch 2x more candidates before rescoring
- **`ignore=False`**: Enable quantization (default behavior)

## Alternative Quantization Methods

If you need different tradeoffs, other quantization methods are available:

### Binary Quantization (For high-dimensional vectors >1024d)
- **Compression**: 32x memory reduction
- **Speed**: Up to 40x faster
- **Accuracy**: 0.95 (for compatible models only)

```python
quantization_config=BinaryQuantization(
    binary=BinaryQuantizationConfig(
        always_ram=True,
    ),
)
```

### Product Quantization (Maximum compression)
- **Compression**: Up to 64x memory reduction
- **Speed**: 0.5x (slower than original)
- **Accuracy**: 0.7 (significant quality loss)

```python
quantization_config=ProductQuantization(
    product=ProductQuantizationConfig(
        compression="x16",
        always_ram=True,
    ),
)
```

## Monitoring and Verification

### Check Collection Status
```python
from app.vector_db import get_qdrant_client

client = get_qdrant_client()
collection_info = client.get_collection("unified_vector_store")
print(f"Quantization: {collection_info.config.quantization_config}")
```

### Performance Testing
Compare search performance with/without quantization:

```python
# Disable quantization for comparison
search_params=models.SearchParams(
    quantization=models.QuantizationSearchParams(ignore=True)
)
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all quantization imports are included:
   ```python
   from qdrant_client.models import ScalarQuantization, ScalarQuantizationConfig, ScalarType
   ```

2. **Memory Issues**: If experiencing memory problems, try hybrid mode:
   ```python
   vectors_config=VectorParams(on_disk=True)  # Original vectors on disk
   always_ram=True  # Quantized vectors in RAM
   ```

3. **Accuracy Loss**: Adjust quantile parameter:
   ```python
   quantile=0.999  # More conservative quantization
   ```

### Performance Monitoring

Monitor these metrics:
- Search latency improvement
- Memory usage reduction
- Search accuracy (recall@k)
- Index build time

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify Qdrant server version supports quantization (v1.1.0+)
3. Test with a small dataset first

## References

- [Qdrant Quantization Documentation](https://qdrant.tech/documentation/guides/quantization/)
- [Performance Optimization Guide](https://qdrant.tech/documentation/guides/optimize/) 