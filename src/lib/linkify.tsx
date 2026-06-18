import React from 'react';

export function renderTextWithLinks(text: string) {
  if (!text) return "";
  
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={index} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
