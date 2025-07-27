import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import { X, Minus, Square, Maximize2, MoreHorizontal } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previousState, setPreviousState] = useState({ position: defaultPosition, size: defaultSize });
  const dragRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (isFullscreen) {
      // Restore to previous state
      setPosition(previousState.position);
      setSize(previousState.size);
      setIsFullscreen(false);
    } else {
      // Save current state and go fullscreen
      setPreviousState({ position, size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 60 }); // Account for dock
      setIsFullscreen(true);
    }
  };

  if (isMinimized) {
    return null;
  }

  return (
    <Draggable
      handle=".window-header"
      position={position}
      onDrag={(e, data) => !isFullscreen && setPosition({ x: data.x, y: data.y })}
      nodeRef={dragRef}
      disabled={isFullscreen}
    >
      <div
        ref={dragRef}
        className={`absolute select-none ${isFullscreen ? 'z-50' : 'z-10'} ${className}`}
        style={{ 
          left: 0, 
          top: 0,
          ...(isFullscreen && { 
            position: 'fixed',
            width: '100vw',
            height: 'calc(100vh - 60px)',
            zIndex: 9999
          })
        }}
      >
        <ResizableBox
          width={size.width}
          height={size.height}
          onResize={(e, { size: newSize }) => setSize(newSize)}
          resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
          className="retro-window"
          minConstraints={[200, 150]}
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
                    className="retro-button p-1 text-xs hover:bg-[hsl(var(--accent))]"
                    style={{ minWidth: '20px', height: '20px' }}
                    title="Minimize"
                  >
                    <Minus size={12} />
                  </button>
                )}
                <button
                  onClick={toggleFullscreen}
                  className="retro-button p-1 text-xs hover:bg-[hsl(var(--accent))]"
                  style={{ minWidth: '20px', height: '20px' }}
                  title={isFullscreen ? "Restore" : "Maximize"}
                >
                  {isFullscreen ? <MoreHorizontal size={12} /> : <Maximize2 size={12} />}
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="retro-button p-1 text-xs bg-red-300 hover:bg-red-400"
                    style={{ minWidth: '20px', height: '20px' }}
                    title="Close"
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