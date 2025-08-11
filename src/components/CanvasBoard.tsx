import React, { useEffect, useRef, useState } from 'react';

interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  timestamp: number;
}

const CanvasBoard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(2);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size - make it much bigger
    const resizeCanvas = () => {
      // Use most of the available space
      const containerWidth = canvas.offsetWidth;
      const containerHeight = canvas.offsetHeight;
      
      // Set canvas to be larger (minimum 1200x800)
      canvas.width = Math.max(1200, containerWidth - 40);
      canvas.height = Math.max(800, containerHeight - 40);
      
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });

      ctx.stroke();
    });
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const newStroke: Stroke = {
      id: Date.now().toString(),
      points: [pos],
      color,
      width: brushSize,
      timestamp: Date.now()
    };

    setCurrentStroke(newStroke);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke) return;

    const pos = getMousePos(e);
    const updatedStroke = {
      ...currentStroke,
      points: [...currentStroke.points, pos]
    };

    setCurrentStroke(updatedStroke);
    redrawCanvas();

    // Draw current stroke
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = updatedStroke.color;
    ctx.lineWidth = updatedStroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (updatedStroke.points.length >= 2) {
      ctx.moveTo(updatedStroke.points[updatedStroke.points.length - 2].x, updatedStroke.points[updatedStroke.points.length - 2].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!currentStroke) return;

    // Add final stroke to strokes array
    const updatedStrokes = [...strokes, currentStroke];
    setStrokes(updatedStrokes);

    setCurrentStroke(null);
    setIsDrawing(false);
    redrawCanvas();
  };

  const clearCanvas = () => {
    const emptyStrokes: Stroke[] = [];
    setStrokes(emptyStrokes);
    redrawCanvas();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-white text-sm">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-600"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-white text-sm">Size:</label>
            <input
              type="range"
              min="1"
              max="10"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-8 h-8 rounded border border-gray-600"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Clear Canvas
          </button>
          <div className="text-xs text-gray-400">
            Status: Local Mode | 
            Strokes: {strokes.length}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-2">
        <canvas
          ref={canvasRef}
          className="border border-gray-600 rounded-lg cursor-crosshair shadow-lg"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ 
            touchAction: 'none',
            maxWidth: '95vw',
            maxHeight: '90vh',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)'
          }}
        />
      </div>
    </div>
  );
};

export default CanvasBoard;

