import re
from typing import Dict, Any, List

def parse_llm_response(response_text: str) -> Dict[str, Any]:
    """
    Parse LLM response and determine formatting type
    Returns structured data for frontend rendering
    """
    parsed_response = {
        "original_text": response_text,
        "formatting_type": "plain",
        "elements": []
    }
    
    # Detect and parse different formatting types
    if _has_bullet_points(response_text):
        parsed_response["formatting_type"] = "bullet_list"
        parsed_response["elements"] = _extract_bullet_points(response_text)
        parsed_response["mixed_content"] = _extract_mixed_content(response_text, "bullet")
    
    elif _has_numbered_list(response_text):
        parsed_response["formatting_type"] = "numbered_list"
        parsed_response["elements"] = _extract_numbered_list(response_text)
        parsed_response["mixed_content"] = _extract_mixed_content(response_text, "numbered")
    
    elif _has_table(response_text):
        parsed_response["formatting_type"] = "table"
        parsed_response["elements"] = _extract_table(response_text)
        parsed_response["mixed_content"] = _extract_mixed_content(response_text, "table")
    
    elif _has_code_blocks(response_text):
        parsed_response["formatting_type"] = "code"
        parsed_response["elements"] = _extract_code_blocks(response_text)
        parsed_response["mixed_content"] = _extract_mixed_content(response_text, "code")
    
    elif _has_bold_or_italic(response_text):
        parsed_response["formatting_type"] = "markdown"
        parsed_response["elements"] = []
        parsed_response["mixed_content"] = [{"type": "markdown", "content": response_text}]
    
    return parsed_response

def _has_bullet_points(text: str) -> bool:
    return bool(re.search(r'^[\s]*[-*+•]\s+', text, re.MULTILINE))

def _has_numbered_list(text: str) -> bool:
    return bool(re.search(r'^[\s]*\d+\.\s+', text, re.MULTILINE))

def _has_table(text: str) -> bool:
    return bool(re.search(r'\|.*\|.*\|', text))

def _has_code_blocks(text: str) -> bool:
    return bool(re.search(r'```[\w]*\n.*?\n```', text, re.DOTALL))

def _has_bold_or_italic(text: str) -> bool:
    return bool(re.search(r'\*\*.*?\*\*|\*.*?\*|__.*?__|_.*?_', text))

def _extract_bullet_points(text: str) -> List[Dict[str, Any]]:
    pattern = r'^[\s]*[-*+•]\s+(.+)$'
    matches = re.findall(pattern, text, re.MULTILINE)
    return [{"type": "bullet", "content": match.strip()} for match in matches]

def _extract_numbered_list(text: str) -> List[Dict[str, Any]]:
    pattern = r'^[\s]*(\d+)\.\s+(.+)$'
    matches = re.findall(pattern, text, re.MULTILINE)
    return [{"type": "numbered", "number": int(num), "content": content.strip()} 
            for num, content in matches]

def _extract_table(text: str) -> List[Dict[str, Any]]:
    lines = text.split('\n')
    table_lines = [line for line in lines if '|' in line and line.strip()]
    
    if len(table_lines) < 2:
        return []
    
    # Extract headers
    headers = [cell.strip() for cell in table_lines[0].split('|')[1:-1] if cell.strip()]
    
    # Skip separator line if it exists (contains ---)
    data_start_idx = 2 if len(table_lines) > 1 and '---' in table_lines[1] else 1
    
    # Extract rows
    rows = []
    for line in table_lines[data_start_idx:]:
        row = [cell.strip() for cell in line.split('|')[1:-1]]
        if row and any(cell.strip() for cell in row):  # Only add non-empty rows
            rows.append(row)
    
    return [{"type": "table", "headers": headers, "rows": rows}]

def _extract_code_blocks(text: str) -> List[Dict[str, Any]]:
    pattern = r'```([\w]*)\n(.*?)\n```'
    matches = re.findall(pattern, text, re.DOTALL)
    return [{"type": "code", "language": lang or "text", "code": code.strip()} 
            for lang, code in matches]

def _extract_mixed_content(text: str, primary_type: str) -> List[Dict[str, Any]]:
    """
    Extract mixed content including text before/after primary formatting elements
    """
    content = []
    
    if primary_type == "bullet":
        # Split by bullet points but preserve surrounding text
        parts = re.split(r'(^[\s]*[-*+•]\s+.+$)', text, flags=re.MULTILINE)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if re.match(r'^[\s]*[-*+•]\s+', part):
                match = re.match(r'^[\s]*[-*+•]\s+(.+)$', part)
                if match:
                    content.append({"type": "bullet", "content": match.group(1).strip()})
            else:
                content.append({"type": "text", "content": part})
    
    elif primary_type == "numbered":
        parts = re.split(r'(^[\s]*\d+\.\s+.+$)', text, flags=re.MULTILINE)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            match = re.match(r'^[\s]*(\d+)\.\s+(.+)$', part)
            if match:
                content.append({"type": "numbered", "number": int(match.group(1)), "content": match.group(2).strip()})
            else:
                content.append({"type": "text", "content": part})
    
    else:
        # For tables and code, just include the whole content
        content.append({"type": "text", "content": text})
    
    return content