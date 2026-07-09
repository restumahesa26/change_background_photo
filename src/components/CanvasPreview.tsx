'use client';

import React, { useEffect, forwardRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface CanvasPreviewProps {
  originalImage: HTMLImageElement | null;
  foregroundCanvas: HTMLCanvasElement | null;
  bgColor: string;
  zoom: number;
  offsetX: number; // percentage (-100 to 100)
  offsetY: number; // percentage (-100 to 100)
  aspectRatio: 'original' | '3:4' | '2:3';
  isProcessing: boolean;
  brushMode: 'none' | 'erase' | 'restore';
  brushSize: number;
  onPaint: (x: number, y: number, mode: 'erase' | 'restore', size: number) => void;
  onPaintStart?: () => void;
  onPaintEnd?: () => void;
  isExpanded?: boolean;
}

const CanvasPreview = forwardRef<HTMLCanvasElement, CanvasPreviewProps>(
  (
    {
      originalImage,
      foregroundCanvas,
      bgColor,
      zoom,
      offsetX,
      offsetY,
      aspectRatio,
      isProcessing,
      brushMode,
      brushSize,
      onPaint,
      onPaintStart,
      onPaintEnd,
      isExpanded,
    },
    ref
  ) => {
    const [brushHoverPos, setBrushHoverPos] = useState<{ x: number; y: number } | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Canvas drawing effect
    useEffect(() => {
      if (!originalImage || !ref) return;

      const canvas = typeof ref === 'function' ? null : ref?.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Calculate Canvas Dimensions based on aspect ratio crop
      let canvasWidth = originalImage.width;
      let canvasHeight = originalImage.height;

      if (aspectRatio === '3:4') {
        const originalRatio = originalImage.width / originalImage.height;
        if (originalRatio > 3 / 4) {
          canvasWidth = Math.round(originalImage.height * (3 / 4));
        } else {
          canvasHeight = Math.round(originalImage.width * (4 / 3));
        }
      } else if (aspectRatio === '2:3') {
        const originalRatio = originalImage.width / originalImage.height;
        if (originalRatio > 2 / 3) {
          canvasWidth = Math.round(originalImage.height * (2 / 3));
        } else {
          canvasHeight = Math.round(originalImage.width * (3 / 2));
        }
      }

      // Update actual canvas dimensions (maintains high quality)
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 2. Draw Background Color
      if (bgColor === 'transparent') {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // 3. Draw Image Layer (foreground cutout if processed, or original image if still processing/fallback)
      const renderSource = foregroundCanvas || originalImage;

      ctx.save();
      
      // Translate to canvas center
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      // Apply positional offsets (converting percentage offsets to pixel coordinates)
      const pixelOffsetX = (offsetX / 100) * canvasWidth;
      const pixelOffsetY = (offsetY / 100) * canvasHeight;
      ctx.translate(pixelOffsetX, pixelOffsetY);

      // Apply zoom factor
      ctx.scale(zoom, zoom);

      // Draw the render source centered
      ctx.drawImage(
        renderSource,
        -originalImage.width / 2,
        -originalImage.height / 2,
        originalImage.width,
        originalImage.height
      );

      ctx.restore();

      // 4. Draw Brush cursor circle overlay (only in active workspace if brush is active)
      if (brushMode !== 'none' && brushHoverPos) {
        ctx.save();
        
        // Translate to canvas center + offsets to draw cursor inside the zoomed/translated coordinate space
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.translate(pixelOffsetX, pixelOffsetY);
        ctx.scale(zoom, zoom);

        // Draw double ring circle cursor at the correct coordinates
        // Outer Ring (White for visibility on dark hair)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.8 / zoom;
        ctx.arc(
          brushHoverPos.x - originalImage.width / 2,
          brushHoverPos.y - originalImage.height / 2,
          brushSize / 2,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        // Inner Ring (Black for visibility on skin/white backgrounds)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(24, 24, 27, 0.5)';
        ctx.lineWidth = 0.8 / zoom;
        ctx.arc(
          brushHoverPos.x - originalImage.width / 2,
          brushHoverPos.y - originalImage.height / 2,
          brushSize / 2,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        ctx.restore();
      }
    }, [
      originalImage, 
      foregroundCanvas, 
      bgColor, 
      zoom, 
      offsetX, 
      offsetY, 
      aspectRatio, 
      ref, 
      brushMode, 
      brushSize, 
      brushHoverPos
    ]);

    // Translate pointer client event coordinates into the original high-resolution image space
    const getTransformedCoordinates = (clientX: number, clientY: number) => {
      if (!originalImage || !ref) return null;
      const canvas = typeof ref === 'function' ? null : ref?.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      // 1. Get coords relative to canvas display bounds (pixels)
      const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
      const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const pixelOffsetX = (offsetX / 100) * canvasWidth;
      const pixelOffsetY = (offsetY / 100) * canvasHeight;

      // 2. Inverse translate (center + user offset offsets)
      const xTranslate = canvasX - (canvasWidth / 2 + pixelOffsetX);
      const yTranslate = canvasY - (canvasHeight / 2 + pixelOffsetY);

      // 3. Inverse scale (zoom factor)
      const xScaled = xTranslate / zoom;
      const yScaled = yTranslate / zoom;

      // 4. Inverse original drawing offset (half the width/height to align top-left)
      const xOrig = xScaled + originalImage.width / 2;
      const yOrig = yScaled + originalImage.height / 2;

      return { x: xOrig, y: yOrig };
    };

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (brushMode === 'none' || !onPaint) return;
      setIsDrawing(true);
      if (onPaintStart) onPaintStart();
      const coords = getTransformedCoordinates(e.clientX, e.clientY);
      if (coords) {
        onPaint(coords.x, coords.y, brushMode, brushSize);
      }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getTransformedCoordinates(e.clientX, e.clientY);
      if (coords) {
        setBrushHoverPos(coords);
        if (isDrawing && brushMode !== 'none' && onPaint) {
          onPaint(coords.x, coords.y, brushMode, brushSize);
        }
      } else {
        setBrushHoverPos(null);
      }
    };

    const handleMouseUpOrLeave = () => {
      setIsDrawing(false);
      setBrushHoverPos(null);
      if (onPaintEnd) onPaintEnd();
    };

    // Touch handlers (Mobile support)
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (brushMode === 'none' || !onPaint || e.touches.length === 0) return;
      setIsDrawing(true);
      if (onPaintStart) onPaintStart();
      const touch = e.touches[0];
      const coords = getTransformedCoordinates(touch.clientX, touch.clientY);
      if (coords) {
        onPaint(coords.x, coords.y, brushMode, brushSize);
      }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const coords = getTransformedCoordinates(touch.clientX, touch.clientY);
      if (coords) {
        setBrushHoverPos(coords);
        if (isDrawing && brushMode !== 'none' && onPaint) {
          // Prevent scroll while painting
          e.preventDefault();
          onPaint(coords.x, coords.y, brushMode, brushSize);
        }
      }
    };

    return (
      <div className="relative flex w-full flex-col items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 shadow-sm bg-grid-pattern min-h-[350px] md:min-h-[500px]">
        {/* Loading overlay during AI processing */}
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/80 backdrop-blur-sm animate-fadeIn">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-neutral-800">Processing AI Background Removal...</p>
            <p className="text-xs text-neutral-400">Isolating subject from background...</p>
          </div>
        )}

        {/* Canvas Display */}
        <div className="relative flex max-w-full items-center justify-center">
          <canvas
            ref={ref}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUpOrLeave}
            className={`max-w-full rounded-xl border border-neutral-200/80 shadow-md transition-all duration-300 ${
              isProcessing ? 'opacity-30 blur-xs' : 'opacity-100'
            } ${
              brushMode !== 'none' ? 'cursor-none touch-none' : 'cursor-default'
            }`}
            style={{
              maxHeight: isExpanded ? '680px' : '480px',
              objectFit: 'contain',
              aspectRatio: aspectRatio === '3:4' ? '3/4' : aspectRatio === '2:3' ? '2/3' : 'auto',
              ...(bgColor === 'transparent' ? {
                backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                backgroundColor: '#ffffff',
              } : {}),
            }}
          />
        </div>

        {/* Helper overlay hints for passport composition */}
        {!isProcessing && originalImage && (
          <div className="mt-4 text-[10px] text-neutral-400 font-medium flex gap-4">
            {brushMode !== 'none' ? (
              <span className="text-neutral-800 font-semibold animate-pulse">
                • DRAG TO PAINT/CORRECT PHOTO EDGES
              </span>
            ) : (
              <>
                <span>• Head should fill 70-80% of space</span>
                <span>• Keep shoulders centered</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

CanvasPreview.displayName = 'CanvasPreview';

export default CanvasPreview;
