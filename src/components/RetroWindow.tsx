import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import { X, Minus, Square } from 'lucide-react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  onClose?: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  className?: string;
}

const RetroWindow: React.FC<RetroWindowProps> = ({
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 },
  onClose,
  onMinimize,
  isMinimized = false,
  className = ''
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const dragRef = useRef<HTMLDivElement>(null);

  if (isMinimized) {
    return null;
  }

  return (
    <Draggable
      handle=".window-header"
      position={position}
      onDrag={(e, data) => setPosition({ x: data.x, y: data.y })}
      nodeRef={dragRef}
    >
      <div
        ref={dragRef}
        className={`absolute z-10 select-none ${className}`}
        style={{ left: 0, top: 0 }}
      >
        <ResizableBox
          width={size.width}
          height={size.height}
          onResize={(e, { size: newSize }) => setSize(newSize)}
          resizeHandles={['se']}
          className="retro-window"
        >
          <div className="h-full flex flex-col">
            {/* Window Header */}
            <div className="window-header retro-window-header flex items-center justify-between cursor-move">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-400 rounded-sm border border-red-600"></div>
                <span className="text-sm font-bold text-[hsl(var(--foreground))]">
                  {title}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                {onMinimize && (
                  <button
                    onClick={onMinimize}
                    className="retro-button p-1 text-xs"
                    style={{ minWidth: '20px', height: '20px' }}
                  >
                    <Minus size={12} />
                  </button>
                )}
                <button
                  className="retro-button p-1 text-xs"
                  style={{ minWidth: '20px', height: '20px' }}
                >
                  <Square size={12} />
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="retro-button p-1 text-xs bg-red-300 hover:bg-red-400"
                    style={{ minWidth: '20px', height: '20px' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Window Content */}
            <div className="flex-1 overflow-hidden bg-[hsl(var(--card))] p-2">
              {children}
            </div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
};

export default RetroWindow;