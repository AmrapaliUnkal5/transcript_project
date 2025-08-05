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
  // If no formatted content or plain type, render as normal text
  if (!formattedContent || formattedContent.formatting_type === 'plain') {
    return (
      <div style={style} className={className}>
        {content}
      </div>
    );
  }

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
                  <span>{item.content}</span>
                </div>
              );
            
            case 'numbered':
              return (
                <div key={index} style={{ display: 'flex', marginBottom: '4px' }}>
                  <span style={{ marginRight: '8px', minWidth: '20px' }}>{item.number}.</span>
                  <span>{item.content}</span>
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
    // Simple markdown parsing for bold text
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={index}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
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