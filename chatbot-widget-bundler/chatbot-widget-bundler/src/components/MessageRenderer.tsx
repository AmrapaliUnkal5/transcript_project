import React from 'react';

interface FormattedContent {
  formatting_type: 'plain' | 'bullet_list' | 'numbered_list' | 'table' | 'code' | 'markdown';
  elements: any[];
  mixed_content?: any[];
  original_text: string;
}

interface MessageRendererProps {
  content: string;
  formattedContent?: FormattedContent;
  style?: React.CSSProperties;
  className?: string;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  content, 
  formattedContent,
  style,
  className 
}) => {
  // Debug logging
  console.log('Widget MessageRenderer - content:', content);
  console.log('Widget MessageRenderer - formattedContent:', formattedContent);
  
  // If no formatted content or plain type, render as normal text
  if (!formattedContent || formattedContent.formatting_type === 'plain') {
    console.log('Widget MessageRenderer - using plain text rendering');
    return (
      <div style={style} className={className}>
        {content}
      </div>
    );
  }
  
  console.log('Widget MessageRenderer - using formatted rendering, type:', formattedContent.formatting_type);

  const renderContent = () => {
    switch (formattedContent.formatting_type) {
      case 'bullet_list':
        return renderMixedContent(formattedContent.mixed_content || formattedContent.elements);

      case 'numbered_list':
        return renderMixedContent(formattedContent.mixed_content || formattedContent.elements);

      case 'table':
        if (formattedContent.elements.length === 0) {
          return <div>{content}</div>;
        }
        const tableData = formattedContent.elements[0];
        return (
          <div>
            {/* Render any text before the table */}
            {renderMixedContent(formattedContent.mixed_content?.filter(item => item.type === 'text') || [])}
            <table style={{ 
              borderCollapse: 'collapse', 
              width: '100%', 
              margin: '8px 0',
              fontSize: '14px',
              border: '1px solid #ddd'
            }}>
              <thead>
                <tr>
                  {tableData.headers?.map((header: string, index: number) => (
                    <th key={index} style={{ 
                      border: '1px solid #ddd', 
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      textAlign: 'left',
                      fontWeight: 'bold'
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows?.map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex}>
                    {row.map((cell: string, cellIndex: number) => (
                      <td key={cellIndex} style={{ 
                        border: '1px solid #ddd', 
                        padding: '8px' 
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'code':
        return (
          <div>
            {formattedContent.elements.map((block, index) => (
              <pre key={index} style={{ 
                backgroundColor: '#f4f4f4',
                padding: '12px',
                borderRadius: '4px',
                overflow: 'auto',
                margin: '8px 0',
                fontSize: '13px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                border: '1px solid #ddd'
              }}>
                <code style={{ fontFamily: 'inherit' }}>
                  {block.code}
                </code>
              </pre>
            ))}
          </div>
        );

      case 'markdown':
        return renderMarkdownText(content);

      default:
        return <div>{content}</div>;
    }
  };

  const renderMixedContent = (contentArray: any[]) => {
    if (!contentArray || contentArray.length === 0) {
      return <div>{content}</div>;
    }

    return (
      <div>
        {contentArray.map((item, index) => {
          switch (item.type) {
            case 'bullet':
              return (
                <div key={index} style={{ display: 'flex', marginBottom: '4px' }}>
                  <span style={{ marginRight: '8px', minWidth: '16px' }}>•</span>
                  <span>{renderMarkdownText(item.content)}</span>
                </div>
              );
            
            case 'numbered':
              return (
                <div key={index} style={{ display: 'flex', marginBottom: '4px' }}>
                  <span style={{ marginRight: '8px', minWidth: '20px' }}>{item.number}.</span>
                  <span>{renderMarkdownText(item.content)}</span>
                </div>
              );
            
            case 'text':
              return (
                <div key={index} style={{ marginBottom: '8px' }}>
                  {renderMarkdownText(item.content)}
                </div>
              );
            
            default:
              return <div key={index}>{item.content}</div>;
          }
        })}
      </div>
    );
  };

  const renderMarkdownText = (text: string) => {
    console.log('Widget renderMarkdownText - input:', text);
    // Simple markdown parsing for bold text
    const parts = text.split(/(\*\*.*?\*\*)/g);
    console.log('Widget renderMarkdownText - parts:', parts);
    
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            console.log('Widget renderMarkdownText - making bold:', part.slice(2, -2));
            return (
              <strong key={index} style={{ fontWeight: 'bold' }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div style={style} className={className}>
      {renderContent()}
    </div>
  );
};