from fastapi import Depends, HTTPException, UploadFile
from requests import Session
from app.vector_db import retrieve_similar_docs, add_document
import pdfplumber 
from typing import Union, List, Dict, Any
import io
import asyncio
import os
import fitz 
import pytesseract
from PIL import Image
import tempfile
import zipfile
from docx import Document
import logging
from app.utils.logger import get_module_logger
from app.utils.ai_logger import log_chunking_operation, log_document_storage
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken
import time
from app.models import Bot
from app.database import get_db
import re

# Create a logger for this module
logger = get_module_logger(__name__)

def extract_text_from_pdf(pdf_file):
    """Extracts text from a PDF file using pdfplumber."""
    try:
        with pdfplumber.open(pdf_file) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        return text.strip() if text.strip() else None
    except Exception as e:
        logger.warning(f"⚠️ Error extracting PDF text: {e}")
        return None

def normalize_markdown_tables(md: str) -> str:
    """
    Normalize markdown by cleaning HTML tags while preserving code blocks.

    - Inside markdown tables: convert <br> to spaces and strip all HTML tags.
    - Outside tables (and outside code blocks): strip HTML tags and convert <br> to spaces.
    - Code blocks (``` fenced) are preserved verbatim.
    """
    lines = md.splitlines()
    out = []
    in_code = False
    in_table = False

    def is_table_sep(line: str) -> bool:
        return bool(re.match(r'^\s*\|[:\-| ]+\|\s*$', line))

    for i, line in enumerate(lines):
        if re.match(r'^\s*```', line):
            in_code = not in_code
            out.append(line)
            continue

        if in_code:
            out.append(line)
            continue

        # Detect start of a markdown table (header row followed by separator)
        if not in_table and line.strip().startswith('|') and '|' in line:
            if i + 1 < len(lines) and is_table_sep(lines[i + 1]):
                in_table = True

        if in_table:
            # Replace HTML breaks within table cells, then strip any remaining HTML tags
            fixed = re.sub(r'<br\s*/?>', ' ', line, flags=re.IGNORECASE)
            fixed = re.sub(r'</?\w+\b[^>]*>', '', fixed, flags=re.IGNORECASE)
            out.append(fixed)
            # End table when the next line is not a table row
            if not (i + 1 < len(lines) and lines[i + 1].strip().startswith('|')):
                in_table = False
        else:
            # Outside tables (and not in code): normalize <br> to space and strip HTML tags
            cleaned = re.sub(r'<br\s*/?>', ' ', line, flags=re.IGNORECASE)
            cleaned = re.sub(r'</?\w+\b[^>]*>', '', cleaned, flags=re.IGNORECASE)
            out.append(cleaned)

    return '\n'.join(out)

def extract_text_from_pdf_images(pdf_content: bytes) -> str:
    """Extracts text from images in a PDF using OCR."""
    try:
        extracted_text = ""
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image = Image.open(io.BytesIO(base_image["image"]))
                extracted_text += pytesseract.image_to_string(image) + " "
        
        return extracted_text.strip()
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from PDF images: {e}")
        return ""

def extract_text_from_image(image_bytes: bytes) -> str:
    """Extracts text from an image file using OCR."""
    try:
        logger.info(f"Starting OCR text extraction from image ({len(image_bytes)} bytes)")
        image = Image.open(io.BytesIO(image_bytes))
        logger.info(f"Image opened successfully: size={image.size}, mode={image.mode}")
        
        # Convert to RGB if needed (for images with alpha channel)
        if image.mode == 'RGBA':
            logger.info("Converting RGBA image to RGB for better OCR compatibility")
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background
        
        # Enhance image for better OCR results
        logger.info("Enhancing image for better OCR results")
        # Resize if too small
        if image.width < 1000 or image.height < 1000:
            factor = max(1000 / image.width, 1000 / image.height)
            new_size = (int(image.width * factor), int(image.height * factor))
            logger.info(f"Resizing image from {image.size} to {new_size} for better OCR")
            image = image.resize(new_size, Image.LANCZOS)
        
        # Extract text with pytesseract
        logger.info("Performing OCR with pytesseract")
        extracted_text = pytesseract.image_to_string(image)
        
        # Check if text was extracted
        if not extracted_text or len(extracted_text.strip()) < 5:
            logger.warning("Initial OCR extraction yielded little or no text, trying with enhanced settings")
            # Try with additional config options
            extracted_text = pytesseract.image_to_string(
                image, 
                config='--psm 3 --oem 3'  # PSM 3: Fully automatic page segmentation, OEM 3: Default neural net
            )
        
        logger.info(f"OCR completed, extracted {len(extracted_text)} characters")
        return extracted_text
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from image: {e}")
        return ""

def extract_text_from_docx(docx_content: bytes) -> str:
    """Extracts text from a DOCX file using multiple methods."""
    try:
        #Method 1: Try docling first
        temp_path = None
        try:
            from docling.document_converter import DocumentConverter
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
                temp_file.write(docx_content)
                temp_path = temp_file.name

            converter = DocumentConverter()  # defaults are enough for DOCX
            result = converter.convert(temp_path)
            md_text = result.document.export_to_markdown()

            if md_text.strip():
                logger.info(f"✅ Successfully extracted {len(md_text)} characters using docling (Markdown).")
                return md_text.strip()
            else:
                logger.warning("⚠️ Docling returned empty content; falling back to other extractors.")

        except ImportError as import_err:
            logger.warning(f"⚠️ Docling import failed: {import_err}, trying other methods.")
        except Exception as docling_err:
            logger.warning(f"⚠️ Docling extraction failed: {docling_err}, trying other methods.")
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to delete temp file {temp_path}: {e}")

        # Method 2: Try docx2txt (more reliable for both formats)
        try:
            import docx2txt
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
                temp_file.write(docx_content)
                temp_path = temp_file.name
            
            text = docx2txt.process(temp_path)
            logger.info(f"✅ Successfully extracted {len(text)} characters using docx2txt")
            return text.strip()
        except Exception as docx2txt_err:
            logger.warning(f"⚠️ docx2txt extraction failed: {docx2txt_err}, trying python-docx")
        finally:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.unlink(temp_path)
        
        # Method 3: Fallback to python-docx
        doc = Document(io.BytesIO(docx_content))
        text = " ".join([para.text for para in doc.paragraphs])
        logger.info(f"✅ Successfully extracted {len(text)} characters using python-docx")
        return text
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOCX: {e}")
        return ""

def extract_text_from_docx_images(docx_content: bytes) -> str:
    """Extracts text from images within a DOCX file."""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            temp_file.write(docx_content)
            temp_path = temp_file.name
        
        extracted_text = ""
        
        with zipfile.ZipFile(temp_path, "r") as docx_zip:
            for file_name in docx_zip.namelist():
                if file_name.startswith("word/media/") and file_name.lower().endswith((".png", ".jpg", ".jpeg")):
                    with docx_zip.open(file_name) as image_file:
                        extracted_text += extract_text_from_image(image_file.read()) + " "
        
        return extracted_text.strip()
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOCX images: {e}")
        return ""
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

def extract_text_from_doc(doc_content: bytes) -> str:
    """Extracts text from older .doc files using multiple methods."""
    temp_path = None
    try:
        # Method 1: Try docx2txt (works for some DOC files)
        try:
            import docx2txt
            with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as temp_file:
                temp_file.write(doc_content)
                temp_path = temp_file.name
            
            text = docx2txt.process(temp_path)
            if text and text.strip():  # Check if we got meaningful content
                logger.info(f"✅ Successfully extracted {len(text)} characters from DOC using docx2txt")
                return text.strip()
            else:
                logger.warning("⚠️ docx2txt returned empty content for DOC file")
        except Exception as docx2txt_err:
            logger.warning(f"⚠️ docx2txt extraction failed for DOC: {docx2txt_err}")
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    temp_path = None
                except:
                    pass
        
        # Method 2: Try olefile to check if it's a valid DOC file
        try:
            import olefile
            logger.info("🔄 Checking if file is a valid DOC file using olefile")
            
            if olefile.isOleFile(io.BytesIO(doc_content)):
                logger.info("✅ File is a valid OLE/DOC file")
                # For now, we'll return a message indicating manual processing might be needed
                # In production, you might want to use a different library or service
                logger.warning("⚠️ File is a valid DOC file but text extraction requires more specialized tools")
                return "This DOC file could not be automatically processed. Please convert it to DOCX format for better compatibility."
            else:
                logger.warning("⚠️ File does not appear to be a valid DOC file")
                return ""
        except ImportError:
            logger.warning("⚠️ olefile library not available")
        except Exception as ole_err:
            logger.warning(f"⚠️ olefile processing failed: {ole_err}")
        
        logger.error("❌ All DOC extraction methods failed")
        return ""
    except Exception as e:
        logger.warning(f"⚠️ Error extracting text from DOC file: {e}")
        return ""

async def extract_text_from_file(file, filename=None) -> Union[str, None]:
    """
    Extracts text from any supported file type (TXT, PDF, DOC, DOCX, PNG, JPG).
    
    Args:
        file: Either a file-like object with read() method or raw bytes content
        filename: If provided, used to determine file type, otherwise tries to use file.filename
    """
    try:
        # Determine filename either from parameter or file attribute
        if filename is None:
            if hasattr(file, 'filename'):
                filename = file.filename
            else:
                logger.warning("⚠️ No filename provided and file object has no filename attribute")
                raise ValueError("Filename must be provided when file does not have filename attribute")
        
        logger.info(f"📄 Extracting text from file: {filename}")
        
        # Get file extension
        file_extension = filename.split(".")[-1].lower()
        logger.info(f"📋 File extension: {file_extension}")

        # Get file content
        if isinstance(file, bytes):
            content = file
        elif hasattr(file, 'read'):
            if asyncio.iscoroutinefunction(getattr(file, 'read')):
                content = await file.read()
            else:
                content = file.read()
        else:
            raise TypeError(f"File must be bytes or have a read() method. Got {type(file)}")

        # Process based on file type
        if file_extension == "txt":
            logger.info("📝 Processing as TXT file")
            text = content.decode("utf-8")
            logger.info(f"✅ Successfully extracted text from TXT file (length: {len(text)})")
            return text
            
        elif file_extension == "pdf":
            logger.info("📄 Processing as PDF file")
            # First try regular text extraction
            file_obj = io.BytesIO(content)
            text = extract_text_from_pdf(file_obj)
            
            # If no text found or very little text, try OCR on images
            if not text or len(text.strip()) < 50:  # Arbitrary threshold
                logger.info("🔍 Trying OCR for possible image-based PDF")
                ocr_text = extract_text_from_pdf_images(content)
                text = (text + " " + ocr_text).strip() if text else ocr_text
            
            if text:
                logger.info(f"✅ Successfully extracted text from PDF file (length: {len(text)})")
            else:
                logger.warning("⚠️ No text extracted from PDF file")
            return text
            
        elif file_extension == "docx":
            logger.info("📝 Processing as DOCX file")
            text = extract_text_from_docx(content)
            ocr_text = extract_text_from_docx_images(content)
            combined_text = (text + " " + ocr_text).strip()
            logger.info(f"✅ Successfully extracted text from DOCX file (length: {len(combined_text)})")
            return combined_text
            
        elif file_extension == "doc":
            logger.info("📝 Processing as DOC file")
            text = extract_text_from_doc(content)
            logger.info(f"✅ Successfully extracted text from DOC file (length: {len(text)})")
            return text
            
        elif file_extension in ("png", "jpg", "jpeg"):
            logger.info("🖼️ Processing as image file")
            text = extract_text_from_image(content)
            logger.info(f"✅ Successfully extracted text from image file (length: {len(text)})")
            return text
            
        else:
            logger.error(f"❌ Unsupported file extension: {file_extension}")
            raise HTTPException(
                status_code=400, 
                detail=f"File format '{file_extension}' is not supported. Supported formats: TXT, PDF, DOC, DOCX, PNG, JPG."
            )

    except Exception as e:
        logger.error(f"❌ Error extracting text from file {filename if filename else 'unknown'}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error extracting text: {str(e)}")

def token_length(text: str) -> int:
    """Return token length of text using tiktoken cl100k_base."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

class MarkdownRecursiveChunker:
    def __init__(self, max_chunk_size: int = 512, min_chunk_size: int = 200,
                 keep_root_header: bool = False, section_overlap: int = 75,
                 include_headers: bool = True):
        """
        Markdown chunker using RecursiveCharacterTextSplitter with header awareness.

        :param max_chunk_size: Maximum characters per chunk
        :param min_chunk_size: Minimum characters per chunk
        :param keep_root_header: Whether to keep the main document title in section_hierarchy
        :param section_overlap: Overlap only when splitting large sections (not between different sections)
        :param include_headers: Whether to include headers in chunk text
        """
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
        self.keep_root_header = keep_root_header
        self.section_overlap = section_overlap
        self.include_headers = include_headers

        # Initialize RecursiveCharacterTextSplitter with NO overlap by default
        # We'll add overlap manually only when splitting sections
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=max_chunk_size,
            chunk_overlap=0,  # No overlap by default
            length_function=lambda text: len(tiktoken.get_encoding("cl100k_base").encode(text)),
            separators=[
                "\n\n",  # Paragraph breaks
                "\n",    # Line breaks
                " ",     # Word breaks
                ""       # Character breaks
            ]
        )

    def chunk_markdown(self, markdown_text: str, file_name: str, file_type: str, file_id: str, bot_id: int) -> List[Dict[str, Any]]:
        """Split markdown text into chunks with configurable header inclusion and part numbering."""

        # Step 1: Extract headers and build document structure
        headers = self._extract_headers(markdown_text)
        sections = self._split_by_headers(markdown_text, headers)

        chunks = []
        chunk_index = 0

        for section in sections:
            header = section['header']
            section_text = section['text'].strip()

            if not section_text:  # Skip empty sections
                continue

            # Step 2: Check if the section is long
            if token_length(section_text) > self.max_chunk_size:
                # Split the section into multiple parts
                text_chunks = self._split_section_with_overlap(section_text, header if self.include_headers else "")
                total_parts = len(text_chunks)

                for i, chunk_text in enumerate(text_chunks):
                    section_part = f"{i+1}/{total_parts}"  # Part number
                    # Prepare chunk text with header and part info
                    if self.include_headers and header:
                        header_text = section['header_text']  # clean header without Markdown symbols
                        header_line = f"[{header_text} — Part {section_part}]"
                        full_text = f"{header_line}\n{chunk_text}".strip()
                    else:
                        full_text = chunk_text.strip()

                    chunks.append(self._add_metadata(
                        full_text,
                        section['hierarchy'],
                        chunk_index,
                        file_name,
                        file_type,
                        file_id,
                        bot_id,
                        0,  # total_chunks will be updated later
                        section_part
                    ))
                    chunk_index += 1

            else:
                # Small section - single chunk
                section_part = None
                if self.include_headers and header:
                    header_line = f"[{section['header_text']}]"
                    full_text = f"{header_line}\n{section_text}".strip()
                else:
                    full_text = section_text

                chunks.append(self._add_metadata(
                    full_text,
                    section['hierarchy'],
                    chunk_index,
                    file_name,
                    file_type,
                    file_id,
                    bot_id,
                    0,  # total_chunks will be updated later
                    section_part
                ))
                chunk_index += 1

        # Update total_chunks in metadata and pass to _add_metadata calls
        total_chunks = len(chunks)

        # Recreate chunks with proper metadata
        updated_chunks = []
        for i, chunk in enumerate(chunks):
            updated_chunks.append(self._add_metadata(
                chunk["text"],
                chunk["metadata"]["section_hierarchy"],
                i,
                file_name,
                file_type,
                file_id,
                bot_id,
                total_chunks,
                chunk["metadata"].get("section_part")
            ))

        return updated_chunks


    def _extract_headers(self, text: str) -> List[Dict]:
        """Find all markdown headers and their positions."""
        header_regex = re.compile(r'^(#{1,6})\s+(.*)', re.MULTILINE)
        headers = []

        for match in header_regex.finditer(text):
            level = len(match.group(1))
            title = match.group(2).strip()
            clean_title = re.sub(r'[*_]', '', title.strip())

            headers.append({
                'level': level,
                'title': title,
                'start': match.start(),
                'end': match.end(),
                'header': f"{'#' * level} {title}",  # Preserve original header format
                'header_text': clean_title  # Clean header text
            })

        return headers

    def _split_by_headers(self, text: str, headers: List[Dict]) -> List[Dict]:
        """Split text into sections with proper parent-child hierarchy."""
        sections = []

        if not headers:
            return [{'header': '', 'text': text, 'hierarchy': []}]

        hierarchy_stack = []  # Track nested header structure

        for i, header in enumerate(headers):
            # Maintain proper hierarchy by popping headers at same or deeper level
            while hierarchy_stack and hierarchy_stack[-1]['level'] >= header['level']:
                hierarchy_stack.pop()

            hierarchy_stack.append(header)

            # Extract section text
            start = header['end']
            end = headers[i + 1]['start'] if i + 1 < len(headers) else len(text)
            section_text = text[start:end].strip()

            # Build hierarchy path
            hierarchy_titles = [h['header_text'] for h in hierarchy_stack]

            # Skip root header if keep_root_header is False
            if not self.keep_root_header and len(hierarchy_titles) > 1:
                hierarchy_titles = hierarchy_titles[1:]

            sections.append({
                'header': header['header'],          # original markdown header (optional)
                'header_text': header['header_text'], # clean header text without # or **
                'text': section_text,
                'hierarchy': hierarchy_titles,
                'level': header['level']
            })

        return sections

    def _split_section_with_overlap(self, section_text: str, header: str = "") -> List[str]:
        """
        Split a large section with intelligent overlap only within the same section.
        No overlap occurs between different sections.
        """
        if token_length(section_text) <= self.max_chunk_size:
            return [section_text]

        # Calculate effective chunk size considering header length (if headers are included)
        header_length = token_length(header) + 1 if (header and self.include_headers) else 0  # +1 for newline
        effective_chunk_size = self.max_chunk_size - header_length

        # Use RecursiveCharacterTextSplitter but with custom overlap handling
        temp_splitter = RecursiveCharacterTextSplitter(
            chunk_size=effective_chunk_size,
            chunk_overlap=self.section_overlap,
            length_function=token_length,
            separators=["\n\n", "\n", " ", ""]
        )

        chunks = temp_splitter.split_text(section_text)
        return chunks

    def _add_metadata(self, chunk_text: str, hierarchy: List[str], chunk_index: int,
                      file_name: str, file_type: str, file_id: str, bot_id: int,
                      total_chunks: int, section_part=None) -> Dict:
        """Add essential metadata to each chunk."""
        return {
            'chunk_id': f"chunk_{chunk_index:04d}",
            'text': chunk_text,
            'metadata': {
                "id": f"{file_id}_chunk_{chunk_index + 1}" if total_chunks > 1 else file_id,
                "source": "upload",
                "file_id": file_id,
                "file_name": file_name,
                "file_type": file_type,
                "bot_id": bot_id,
                "chunk_number": chunk_index + 1,
                "total_chunks": total_chunks,
                "section_hierarchy": hierarchy,
                "section_part": section_part
            }
        }
    
    def merge_small_chunks(self, chunks: List[Dict], min_tokens: int = 200, max_tokens: int = 512, file_id: str = None) -> List[Dict]:
        """
        Merge consecutive small chunks until we reach min_tokens.
        Keeps metadata of merged chunks.
        Preserves original part headers in text.
        """
        merged = []
        buffer_text = ""
        buffer_meta = []
        chunk_index = 0

        for chunk in chunks:
            # Concatenate buffer with current chunk text
            candidate_text = (buffer_text + "\n" + chunk["text"]).strip() if buffer_text else chunk["text"]
            tokens = token_length(candidate_text)

            if tokens < min_tokens:
                buffer_text = candidate_text
                buffer_meta.append(chunk)
            else:
                # If only one chunk (no merge happened), preserve original metadata
                if not buffer_meta:
                    merged.append({
                        "chunk_id": f"chunk_{chunk_index:04d}",
                        "text": chunk["text"],
                        "metadata": chunk["metadata"].copy()  # Keep original
                    })
                else:
                    # Actually merging multiple chunks
                    merged.append({
                        "chunk_id": f"chunk_{chunk_index:04d}",
                        "text": candidate_text,
                        "metadata": self.merge_metadata([c["metadata"] for c in buffer_meta + [chunk]])
                    })
                buffer_text = ""
                buffer_meta = []
                chunk_index += 1

        # Flush remaining buffer
        if buffer_text:
            if len(buffer_meta) == 1:
                # Only one leftover chunk → keep original metadata
                merged.append({
                    "chunk_id": f"chunk_{chunk_index:04d}",
                    "text": buffer_meta[0]["text"],
                    "metadata": buffer_meta[0]["metadata"].copy()  # Keep original
                })
            else:
                # Multiple chunks being merged
                merged.append({
                    "chunk_id": f"chunk_{chunk_index:04d}",
                    "text": buffer_text,
                    "metadata": self.merge_metadata([c["metadata"] for c in buffer_meta])
                })

        # Update chunk_number and total_chunks
        total_chunks = len(merged)
        for i, chunk in enumerate(merged):
            chunk["metadata"]["chunk_number"] = i + 1
            chunk["metadata"]["total_chunks"] = total_chunks

        # Regenerate IDs to match new sequential chunk numbers
        if file_id:
            for i, chunk in enumerate(merged):
                chunk["metadata"]["id"] = f"{file_id}_chunk_{i + 1}" if total_chunks > 1 else file_id

        return merged

    @staticmethod
    def merge_metadata(meta_list: List[Dict]) -> Dict:
        """Merge metadata from multiple chunks into a single metadata object."""
        if not meta_list:
            return {}

        first = meta_list[0]
        merged_hierarchy = []
        for m in meta_list:
            for h in m.get("section_hierarchy", []):
                if h not in merged_hierarchy:
                    merged_hierarchy.append(h)

        # Include section_part as "merged"
        return {
            "id": first.get("id", first.get("chunk_number")),
            "source": first.get("source", "upload"),
            "file_id": first.get("file_id"),
            "file_name": first.get("file_name"),
            "file_type": first.get("file_type"),
            "bot_id": first.get("bot_id"),
            "section_hierarchy": merged_hierarchy,
            "section_part": "merged"
        }

def chunk_markdown_text(
    markdown_text: str,
    file_name: str,
    file_id: str,
    file_type: str,
    chunk_size: int = None,
    section_overlap: int = 75,
    bot_id: int = None,
    user_id: int = None,
    db: Session = Depends(get_db),
    file_info: Dict = None
) -> List[Dict]:
    """
    Chunk markdown text using MarkdownRecursiveChunker with metadata support.
    """
    start_time = time.time()
    text_length = len(markdown_text)

    # If bot-specific config exists, override defaults
    if bot_id and (chunk_size is None):
        bot_config = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if bot_config:
            chunk_size = chunk_size or bot_config.chunk_size
        else:
            logger.warning(f"⚠️ Bot ID {bot_id} not found, falling back to default chunk values.")

    # Defaults
    chunk_size = chunk_size or 512
    section_overlap = section_overlap or 75

    logger.info(f"🔪 Markdown chunking text of length {text_length} with chunk_size={chunk_size}, section_overlap={section_overlap}")

    try:
        # Initialize new Markdown-aware chunker
        chunker = MarkdownRecursiveChunker(
            max_chunk_size=chunk_size,
            min_chunk_size=200,
            section_overlap=section_overlap,
            keep_root_header=False,

        )

        # Split text
        chunks = chunker.chunk_markdown(markdown_text, file_name, file_type, file_id, bot_id)
        chunks_count = len(chunks)

        # ========== MERGING LOGIC: Merge small chunks if average size is too small ==========
        # Calculate average chunk size
        avg_size = sum(token_length(c['text']) for c in chunks) // len(chunks) if chunks else 0
        
        # Define merge threshold (fixed at 200 tokens, matching colleague's implementation)
        merge_threshold = 200
        
        logger.info(f"📊 Average chunk size before merge: {avg_size} tokens (threshold: {merge_threshold})")
        
        # Merge small chunks if average size below threshold
        if avg_size < merge_threshold:
            logger.info(f"⚠️ Average chunk size below {merge_threshold}, merging small chunks...")
            chunks = chunker.merge_small_chunks(chunks, file_id=file_id)
            chunks_count = len(chunks)
            logger.info(f"✅ Merged chunks. New count: {chunks_count}")
            
            # Calculate new average after merging
            avg_size_post = sum(token_length(c['text']) for c in chunks) // len(chunks) if chunks else 0
            logger.info(f"📏 Average chunk size after merge: {avg_size_post} tokens")
        else:
            logger.info("✅ Chunk sizes are fine. No merging needed.")
        # ========== END OF MERGING LOGIC ==========

        # Debugging preview
        # for i, chunk in enumerate(chunks[:5], start=1):  # only show first 5 to avoid flooding
        #     print(f"\n--- Chunk {i}/{chunks_count} ---")
        #     print("Text:", chunk["text"][:300])
        #     print("Metadata:", chunk["metadata"])
        #     print("---------------")

        # Log operation
        if bot_id and user_id:
            log_chunking_operation(
                user_id=user_id,
                bot_id=bot_id,
                text_length=text_length,
                chunk_size=chunk_size,
                chunk_overlap=section_overlap,
                chunks_count=chunks_count,
                file_info=file_info
            )

        logger.info(f"✅ Successfully split markdown into {chunks_count} chunks")
        return chunks

    except Exception as e:
        logger.warning(f"⚠️ Error chunking markdown text: {e}")
        if bot_id and user_id:
            log_chunking_operation(
                user_id=user_id,
                bot_id=bot_id,
                text_length=text_length,
                chunk_size=chunk_size,
                chunk_overlap=section_overlap,
                chunks_count=1,
                file_info=file_info,
                extra={"error": str(e), "fallback": "single_chunk"}
            )
        return [{
            "chunk_id": "chunk_0000",
            "text": markdown_text,
            "metadata": {
                "file_name": file_name,
                "file_type": "markdown",
                "chunk_number": 1,
                "total_chunks": 1,
                "section_hierarchy": []
            }
        }]

def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None, bot_id: int = None, user_id: int = None,db: Session = Depends(get_db), file_info: Dict = None) -> List[str]:
    """
    Chunks text into smaller pieces suitable for embeddings.
    
    Args:
        text: The text to chunk
        chunk_size: Target size of each chunk in tokens
        chunk_overlap: Overlap between chunks in tokens
        bot_id: Optional bot ID for logging
        user_id: Optional user ID for logging
        file_info: Optional file information for logging
        
    Returns:
        List of text chunks
    """
    start_time = time.time()
    text_length = len(text)

    if bot_id and (chunk_size is None or chunk_overlap is None):
        bot_config = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        print("bot_config.chunk_size=>",bot_config.chunk_size)
        print("bot_config.chunk_overlap=>",bot_config.chunk_overlap)
        if bot_config:
            chunk_size = chunk_size or bot_config.chunk_size
            chunk_overlap = chunk_overlap or bot_config.chunk_overlap
        else:
            logger.warning(f"⚠️ Bot ID {bot_id} not found, falling back to default chunk values.")
    
    # Fallback to default if still None
    chunk_size = chunk_size or 1000
    chunk_overlap = chunk_overlap or 100
    
    logger.info(f"🔪 Chunking text of length {text_length} with chunk_size={chunk_size}, overlap={chunk_overlap}")
    
    try:
        # Initialize the text splitter
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=lambda text: len(tiktoken.get_encoding("cl100k_base").encode(text)),
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Split the text into chunks
        chunks = text_splitter.split_text(text)
        chunks_count = len(chunks)
        # 🔹 Print all chunks for debugging
        for i, chunk in enumerate(chunks, start=1):
            print(f"\n--- Chunk {i}/{chunks_count} ---")
            print(chunk[:500])  # Print first 500 chars (to avoid flooding console if text is huge)
            print("---------------")
        
        # Log chunking operation if bot_id and user_id are provided
        if bot_id and user_id:
            log_chunking_operation(
                user_id=user_id,
                bot_id=bot_id,
                text_length=text_length,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                chunks_count=chunks_count,
                file_info=file_info
            )
        
        logger.info(f"✅ Successfully split text into {chunks_count} chunks")
        return chunks
    
    except Exception as e:
        logger.warning(f"⚠️ Error chunking text: {e}")
        # If chunking fails, return the text as a single chunk
        logger.info("⚠️ Returning original text as single chunk")
        
        # Log chunking failure if bot_id and user_id are provided
        if bot_id and user_id:
            log_chunking_operation(
                user_id=user_id,
                bot_id=bot_id,
                text_length=text_length,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                chunks_count=1,
                file_info=file_info,
                extra={"error": str(e), "fallback": "single_chunk"}
            )
        
        return [text]

def validate_and_store_text_in_ChromaDB(text: str, bot_id: int, file, user_id: int = None) -> None:
    """
    Validates extracted text and stores it in ChromaDB.
    
    Args:
        text: The text content to store
        bot_id: The bot ID
        file: The file object with metadata
        user_id: Optional user ID for model selection
    """
   
    if not text:
        logger.warning(f"⚠️ No extractable text found in the file: {file.filename}")
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    # Create a more complete metadata object
    file_name = getattr(file, 'filename', 'unknown')
    file_type = getattr(file, 'content_type', os.path.splitext(file_name)[1] if hasattr(file, 'filename') else 'unknown')
    
    # Create file info for logging
    file_info = {
        "file_name": file_name,
        "file_type": file_type,
        "content_length": len(text)
    }
    
    print("Reached here")
    # Split text into chunks for embedding
    chunks = chunk_text(text, bot_id=bot_id, user_id=user_id, file_info=file_info)
    
    # Store each chunk with metadata
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            "id": f"{file_name}_{i}" if len(chunks) > 1 else file_name,
            "file_type": file_type,
            "file_name": file_name,
            "chunk_number": i + 1,
            "total_chunks": len(chunks)
        }
        
        # Store chunk in ChromaDB
        logger.info(f"💾 Storing chunk {i+1}/{len(chunks)} in ChromaDB for bot {bot_id}: {chunk_metadata['id']}")
        
        try:
            # Store the document and log the storage
            add_document(bot_id, chunk, chunk_metadata, user_id=user_id)
            
            # Log document storage if user_id is provided
            if user_id:
                collection_name = f"bot_{bot_id}"  # Simplified collection name for logging
                log_document_storage(
                    user_id=user_id,
                    bot_id=bot_id,
                    collection_name=collection_name,
                    document_count=1,
                    metadata=chunk_metadata
                )
        except Exception as e:
            logger.error(f"❌ Error storing chunk in ChromaDB: {e}")
            # Continue with other chunks even if one fails