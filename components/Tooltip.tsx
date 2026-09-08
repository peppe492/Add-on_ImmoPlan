import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      {isVisible && (
        <div className="absolute z-10 w-64 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow-sm -top-10 left-1/2 transform -translate-x-1/2 -translate-y-full">
          {text}
          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"></div>
        </div>
      )}
    </div>
  );
};