"""
File storage utility for handling both local and S3 storage based on environment variables.

This module provides a unified interface for saving files to either local filesystem
or Amazon S3, determined by the target directory environment variable.
"""

import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from typing import Union, BinaryIO
import logging
from app.utils.logger import get_module_logger

# Create a logger for this module
logger = get_module_logger(__name__)


class FileStorageError(Exception):
    """Custom exception for file storage operations."""
    pass


def save_file(target_dir_env: str, filename: str, file_content: Union[bytes, BinaryIO], 
              create_subdirs: bool = True) -> str:
    """
    Save a file to either local storage or S3 based on the environment variable.
    
    Args:
        target_dir_env (str): Environment variable name containing the target directory/bucket
        filename (str): Name of the file to save
        file_content (Union[bytes, BinaryIO]): File content as bytes or file-like object
        create_subdirs (bool): Whether to create subdirectories if they don't exist (local only)
    
    Returns:
        str: Full file path (for local) or S3 URI (for S3)
    
    Raises:
        FileStorageError: If the operation fails or environment variable is missing
    """
    
    # Get the target directory from environment variable
    target_path = target_dir_env
    if not target_path:
        raise FileStorageError(f"Environment variable '{target_dir_env}' is not set")
    
    logger.info(f"Saving file '{filename}' using target path from env '{target_dir_env}': {target_path}")
    
    try:
        if target_path.startswith('s3://'):
            # S3 storage
            return _save_to_s3(target_path, filename, file_content)
        else:
            # Local storage
            return _save_to_local(target_path, filename, file_content, create_subdirs)
    except Exception as e:
        logger.error(f"Failed to save file '{filename}': {str(e)}")
        raise FileStorageError(f"Failed to save file '{filename}': {str(e)}")


def _save_to_s3(s3_path: str, filename: str, file_content: Union[bytes, BinaryIO]) -> str:
    """
    Save file to S3.
    
    Args:
        s3_path (str): S3 path in format s3://bucket/prefix
        filename (str): Name of the file
        file_content (Union[bytes, BinaryIO]): File content
    
    Returns:
        str: S3 URI of the saved file
    """
    # Parse S3 path
    if not s3_path.startswith('s3://'):
        raise FileStorageError(f"Invalid S3 path format: {s3_path}")
    
    # Remove s3:// prefix and split bucket and prefix
    path_parts = s3_path[5:].split('/', 1)
    bucket_name = path_parts[0]
    prefix = path_parts[1] if len(path_parts) > 1 else ''
    
    # Construct S3 key
    s3_key = f"{prefix}/{filename}".lstrip('/')
    
    logger.info(f"Uploading to S3: bucket='{bucket_name}', key='{s3_key}'")
    
    try:
        # Initialize S3 client
        s3_client = boto3.client('s3')
        
        # Prepare file content for upload
        if hasattr(file_content, 'read'):
            # File-like object
            file_data = file_content.read()
            if hasattr(file_content, 'seek'):
                file_content.seek(0)  # Reset file pointer
        else:
            # Bytes
            file_data = file_content
        
        # Upload to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_data
        )
        
        s3_uri = f"s3://{bucket_name}/{s3_key}"
        logger.info(f"Successfully uploaded file to S3: {s3_uri}")
        return s3_uri
        
    except NoCredentialsError:
        raise FileStorageError("AWS credentials not found. Please configure AWS credentials.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            raise FileStorageError(f"S3 bucket '{bucket_name}' does not exist")
        else:
            raise FileStorageError(f"S3 operation failed: {e.response['Error']['Message']}")


def _save_to_local(local_path: str, filename: str, file_content: Union[bytes, BinaryIO], 
                   create_subdirs: bool = True) -> str:
    """
    Save file to local filesystem.
    
    Args:
        local_path (str): Local directory path
        filename (str): Name of the file
        file_content (Union[bytes, BinaryIO]): File content
        create_subdirs (bool): Whether to create subdirectories if they don't exist
    
    Returns:
        str: Full local file path
    """
    # Create directory if it doesn't exist
    if create_subdirs:
        os.makedirs(local_path, exist_ok=True)
        logger.debug(f"Ensured directory exists: {local_path}")
    
    # Construct full file path
    file_path = os.path.join(local_path, filename)
    
    logger.info(f"Saving file to local path: {file_path}")
    
    try:
        # Prepare file content for writing
        if hasattr(file_content, 'read'):
            # File-like object
            file_data = file_content.read()
            if hasattr(file_content, 'seek'):
                file_content.seek(0)  # Reset file pointer
        else:
            # Bytes
            file_data = file_content
        
        # Write file to local filesystem
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        logger.info(f"Successfully saved file to local storage: {file_path}")
        return file_path
        
    except IOError as e:
        raise FileStorageError(f"Failed to write file to local storage: {str(e)}")


def get_file_url(target_dir_env: str, filename: str, base_url: str = None) -> str:
    """
    Get the URL for accessing a saved file.
    
    Args:
        target_dir_env (str): Environment variable name containing the target directory/bucket
        filename (str): Name of the file
        base_url (str): Base URL for local files (required for local storage)
    
    Returns:
        str: Accessible URL for the file
    
    Raises:
        FileStorageError: If the operation fails or required parameters are missing
    """
    target_path = target_dir_env
    if not target_path:
        raise FileStorageError(f"Environment variable '{target_dir_env}' is not set")
    
    if target_path.startswith('s3://'):
        # For S3, return the S3 URI (you might want to generate presigned URLs in production)
        path_parts = target_path[5:].split('/', 1)
        bucket_name = path_parts[0]
        prefix = path_parts[1] if len(path_parts) > 1 else ''
        s3_key = f"{prefix}/{filename}".lstrip('/')
        return f"s3://{bucket_name}/{s3_key}"
        # Generate a presigned URL

    else:
        # For local storage, construct HTTP URL
        if not base_url:
            raise FileStorageError("base_url is required for local file URLs")
        
        # Get just the directory name from the full path for URL construction
        dir_name = os.path.basename(target_path.rstrip('/'))
        return f"{base_url.rstrip('/')}/{dir_name}/{filename}"

def resolve_file_url(file_url: str, expires_in: int = 86400) -> str:
    """
    Resolves the actual URL to be returned to frontend.
    If it's S3, generates a presigned URL.
    If it's local, returns as-is.

    :param file_url: Stored file URL (either s3://bucket/key or local HTTP path)
    :param expires_in: Expiry time for presigned URL (default: 1 day)
    :return: Final usable URL
    """
    if file_url.startswith("s3://"):
        path_parts = file_url[5:].split("/", 1)
        if len(path_parts) < 2:
            raise ValueError("Invalid S3 URI")

        bucket = path_parts[0]
        key = path_parts[1]
        logger.info(f"Successfully got S3 location: s3://{bucket}/{key}")

        s3_client = boto3.client("s3")
        presigned_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in
        )
        return presigned_url
    else:
        return file_url


def delete_file(target_dir_env: str, filename: str) -> bool:
    """
    Delete a file from either local storage or S3.
    
    Args:
        target_dir_env (str): Environment variable name containing the target directory/bucket
        filename (str): Name of the file to delete
    
    Returns:
        bool: True if successful, False otherwise
    """
    target_path = os.getenv(target_dir_env)
    if not target_path:
        logger.error(f"Environment variable '{target_dir_env}' is not set")
        return False
    
    try:
        if target_path.startswith('s3://'):
            # S3 deletion
            path_parts = target_path[5:].split('/', 1)
            bucket_name = path_parts[0]
            prefix = path_parts[1] if len(path_parts) > 1 else ''
            s3_key = f"{prefix}/{filename}".lstrip('/')
            
            s3_client = boto3.client('s3')
            s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
            logger.info(f"Successfully deleted S3 file: s3://{bucket_name}/{s3_key}")
            return True
        else:
            # Local deletion
            file_path = os.path.join(target_path, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Successfully deleted local file: {file_path}")
                return True
            else:
                logger.warning(f"File does not exist: {file_path}")
                return False
    except Exception as e:
        logger.error(f"Failed to delete file '{filename}': {str(e)}")
        return False 