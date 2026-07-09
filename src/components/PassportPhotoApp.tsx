'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from './Header';
import Dropzone from './Dropzone';
import CanvasPreview from './CanvasPreview';
import {
  Undo2,
  Download,
  Image as ImageIcon,
  ZoomIn,
  RotateCcw,
  HelpCircle,
  Scissors,
  Paintbrush,
  Eraser,
  MousePointer,
  Trash2,
  Palette,
  Maximize2,
  Minimize2
} from 'lucide-react';

type AspectRatio = 'original' | '3:4' | '2:3';
type BrushMode = 'none' | 'erase' | 'restore';

const PASSPORT_COLORS = [
  { name: 'Merah (Odd Year)', value: '#db1514' },
  { name: 'Biru (Even Year)', value: '#0b4c8c' },
  { name: 'Putih (Visa/General)', value: '#ffffff' },
  { name: 'Transparan (PNG)', value: 'transparent' },
];

export default function PassportPhotoApp() {
  // Image states
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [foregroundCanvas, setForegroundCanvas] = useState<HTMLCanvasElement | null>(null);

  // App status states
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Layout states
  const [isExpanded, setIsExpanded] = useState(false);

  // Adjustment states
  const [bgColor, setBgColor] = useState('#db1514');
  const [customColor, setCustomColor] = useState('#db1514');
  const [zoom, setZoom] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [edgeContraction, setEdgeContraction] = useState(0.5); // default 0.5px choke (keeps ears!)
  const [edgeFeather, setEdgeFeather] = useState(1.0);         // default 1.0px smoothness

  // Brush editor states
  const [brushMode, setBrushMode] = useState<BrushMode>('none');
  const [brushSize, setBrushSize] = useState(20);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<any>(null);
  const pendingImageRef = useRef<HTMLImageElement | null>(null);
  const rawMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPaintPosRef = useRef<{ x: number; y: number } | null>(null);

  // Track sliders in refs to prevent model re-initialization
  const edgeContractionRef = useRef(edgeContraction);
  const edgeFeatherRef = useRef(edgeFeather);

  useEffect(() => {
    edgeContractionRef.current = edgeContraction;
  }, [edgeContraction]);

  useEffect(() => {
    edgeFeatherRef.current = edgeFeather;
  }, [edgeFeather]);

  // Initialize MediaPipe Selfie Segmentation client-side (runs once on mount)
  useEffect(() => {
    const initModel = async () => {
      try {
        const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');

        const segmenter = new SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        segmenter.setOptions({
          modelSelection: 1, // 0 = general (full body), 1 = landscape (faster/tighter portrait)
        });

        segmenter.onResults((results) => {
          const width = results.image.width;
          const height = results.image.height;

          // Paint the raw mask onto an offscreen canvas
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = width;
          maskCanvas.height = height;
          const maskCtx = maskCanvas.getContext('2d');

          if (maskCtx) {
            maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
            rawMaskCanvasRef.current = maskCanvas;

            // Store a copy of the initial AI mask for resets
            const copyCanvas = document.createElement('canvas');
            copyCanvas.width = width;
            copyCanvas.height = height;
            const copyCtx = copyCanvas.getContext('2d');
            if (copyCtx) {
              copyCtx.drawImage(maskCanvas, 0, 0);
              initialMaskCanvasRef.current = copyCanvas;
            }
          }

          // Apply initial mask and cutout using the fresh image from results and current slider values
          if (results.image) {
            applyMaskAndCutout(
              results.image as unknown as HTMLCanvasElement,
              maskCanvas,
              edgeContractionRef.current,
              edgeFeatherRef.current
            );
          }
          setIsProcessing(false);
        });

        segmenterRef.current = segmenter;
        setIsModelLoading(false);

        // If there was an image waiting to be processed, run it now
        if (pendingImageRef.current) {
          setIsProcessing(true);
          segmenter.send({ image: pendingImageRef.current });
          pendingImageRef.current = null;
        }
      } catch (err) {
        console.error('Failed to load MediaPipe Selfie Segmentation:', err);
        setModelError('Could not initialize the background removal AI. Please check your internet connection.');
        setIsModelLoading(false);
      }
    };

    initModel();
  }, []);

  // Apply mask with erosion (contraction) and blur (feather) to cut out subject
  const applyMaskAndCutout = (
    img: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    rawMask: HTMLCanvasElement,
    contraction: number,
    feather: number
  ) => {
    const width = img.width;
    const height = img.height;

    // 1. Erode the mask (shrink edges)
    let processedMask = rawMask;
    if (contraction > 0) {
      processedMask = erodeMaskCanvas(rawMask, contraction);
    }

    // 2. Feather the mask (soften edges)
    if (feather > 0) {
      processedMask = featherMaskCanvas(processedMask, feather);
    }

    // 3. Perform clipping composite
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    if (tempCtx) {
      tempCtx.drawImage(processedMask, 0, 0, width, height);
      tempCtx.globalCompositeOperation = 'source-in';
      tempCtx.drawImage(img, 0, 0, width, height);
      setForegroundCanvas(tempCanvas);
    }
  };

  // Watch for edge control adjustments to re-run cutout instantly
  useEffect(() => {
    if (originalImage && rawMaskCanvasRef.current) {
      applyMaskAndCutout(
        originalImage,
        rawMaskCanvasRef.current,
        edgeContraction,
        edgeFeather
      );
    }
  }, [edgeContraction, edgeFeather, originalImage]);

  // Handle uploaded image
  const handleFileSelect = (file: File) => {
    setIsProcessing(true);

    // Clear previous settings
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setForegroundCanvas(null);
    setBrushMode('none');
    setIsExpanded(false);
    rawMaskCanvasRef.current = null;
    initialMaskCanvasRef.current = null;

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setOriginalImage(img);

      if (segmenterRef.current) {
        segmenterRef.current.send({ image: img });
      } else {
        // Save as pending if model is still loading
        pendingImageRef.current = img;
      }
    };

    img.src = imageUrl;
  };

  // Color picker helper
  const handleColorChange = (color: string) => {
    setBgColor(color);
    setCustomColor(color);
  };

  // Download final result
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isTransparent = bgColor === 'transparent';
    const mimeType = isTransparent ? 'image/png' : 'image/jpeg';
    const extension = isTransparent ? 'png' : 'jpg';

    // Convert canvas content to data URL (use undefined quality for png)
    const dataUrl = canvas.toDataURL(mimeType, isTransparent ? undefined : 0.95);

    // Create download link
    const link = document.createElement('a');
    const ratioName = aspectRatio === 'original' ? 'full' : aspectRatio === '3:4' ? '3x4' : '2x3';
    link.download = `pasfoto_${ratioName}_${Date.now()}.${extension}`;
    link.href = dataUrl;
    link.click();

    // Celebratory confetti effect
    import('canvas-confetti').then((confetti) => {
      confetti.default({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#db1514', '#0b4c8c', '#ffffff', '#ffd700'],
      });
    });
  };

  // Reset positioning offsets
  const handleResetAdjustments = () => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
    setEdgeContraction(0.5);
    setEdgeFeather(1.0);
    setBrushMode('none');
    setBrushSize(20);
    setIsExpanded(false);
  };

  // Remove current photo
  const handleRemovePhoto = () => {
    setOriginalImage(null);
    setForegroundCanvas(null);
    rawMaskCanvasRef.current = null;
    initialMaskCanvasRef.current = null;
    setIsExpanded(false);
    handleResetAdjustments();
  };

  // Reset manual brush edits back to original AI mask
  const handleResetManualEdits = () => {
    const rawMask = rawMaskCanvasRef.current;
    const initialMask = initialMaskCanvasRef.current;
    if (rawMask && initialMask && originalImage) {
      const ctx = rawMask.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, rawMask.width, rawMask.height);
        ctx.drawImage(initialMask, 0, 0);
        applyMaskAndCutout(originalImage, rawMask, edgeContraction, edgeFeather);
      }
    }
  };

  // Stroke paint handlers
  const handlePaintStart = () => {
    prevPaintPosRef.current = null;
  };

  const handlePaintEnd = () => {
    prevPaintPosRef.current = null;
  };

  const handlePaint = (x: number, y: number, mode: 'erase' | 'restore', size: number) => {
    const rawMask = rawMaskCanvasRef.current;
    if (!rawMask || !originalImage) return;

    const ctx = rawMask.getContext('2d');
    if (!ctx) return;

    ctx.save();

    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
    }

    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const prev = prevPaintPosRef.current;

    ctx.beginPath();
    if (prev) {
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    prevPaintPosRef.current = { x, y };

    // Update cutout
    applyMaskAndCutout(originalImage, rawMask, edgeContraction, edgeFeather);
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50/50">
      <Header />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Error Alert */}
        {modelError && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 shadow-xs">
            <span className="font-semibold">AI System Error:</span> {modelError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COLUMN: UPLOAD & CONTROLS */}
          {!isExpanded && (
            <section className="lg:col-span-5 space-y-6">

              {/* 1. Upload Card */}
              {!originalImage ? (
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-neutral-500" />
                      Source Image
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      Upload a high-quality portrait photo with clear lighting and a visible face.
                    </p>
                  </div>

                  {isModelLoading && (
                    <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-100 p-3 text-xs text-neutral-600 flex items-center gap-2.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-2xs">
                        <div className="h-3 w-3 rounded-full border border-neutral-300 border-t-neutral-800 animate-spin" />
                      </div>
                      <span>Initializing MediaPipe segmenter engine...</span>
                    </div>
                  )}

                  <Dropzone onFileSelect={handleFileSelect} />
                </div>
              ) : (
                /* 2. Adjustment Panel */
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">

                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-neutral-900">
                        Studio Controls
                      </h2>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Configure colors, sizing, and edges.
                      </p>
                    </div>

                    <button
                      onClick={handleRemovePhoto}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all shadow-3xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Photo</span>
                    </button>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section A: Background Color Selection */}
                  <div className="space-y-3.5">
                    <label className="text-xs font-semibold text-neutral-800 tracking-wide uppercase flex items-center gap-2">
                      <Palette className="h-4 w-4 text-neutral-400" />
                      Background Color
                    </label>

                    {/* Preset Swatches */}
                    <div className="grid grid-cols-2 gap-2">
                      {PASSPORT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => handleColorChange(color.value)}
                          className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs font-medium transition-all ${bgColor === color.value
                              ? 'border-neutral-900 bg-neutral-950 text-white shadow-2xs'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50/50'
                            }`}
                        >
                          <span
                            className="h-4.5 w-4.5 rounded-md border border-black/10 shadow-3xs shrink-0"
                            style={{ backgroundColor: color.value }}
                          />
                          <span className="truncate">{color.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Hex Picker Input */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 p-2.5 bg-neutral-50/20">
                      <span className="text-xs text-neutral-400 font-medium pl-1 shrink-0">Custom Hex:</span>
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        placeholder="#db1514"
                        className="flex-1 bg-transparent border-0 p-0 text-xs font-semibold font-mono text-neutral-800 placeholder-neutral-300 focus:ring-0 focus:outline-hidden"
                      />
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="h-7 w-7 rounded-lg border border-neutral-200 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                      />
                    </div>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section B: Aspect Ratio Crop */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-neutral-800 tracking-wide uppercase flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-neutral-400" />
                      Cropping (Aspect Ratio)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['original', '3:4', '2:3'] as AspectRatio[]).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`rounded-xl border py-2 text-xs font-medium uppercase transition-all ${aspectRatio === ratio
                              ? 'border-neutral-900 bg-neutral-950 text-white shadow-2xs'
                              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50/50'
                            }`}
                        >
                          {ratio === 'original' ? 'Original' : ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section C: Sizing / Positioning */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-800 tracking-wide uppercase flex items-center gap-2">
                        <ZoomIn className="h-4 w-4 text-neutral-400" />
                        Face Alignment
                      </label>
                      <button
                        onClick={handleResetAdjustments}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Position
                      </button>
                    </div>

                    {/* Zoom Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-600">
                        <span className="flex items-center gap-1"><ZoomIn className="h-3.5 w-3.5 text-neutral-400" /> Scale Zoom</span>
                        <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">{zoom.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Horizontal Position Offset */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-600">
                        <span>Horizontal Shift (X)</span>
                        <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">
                          {offsetX > 0 ? `+${offsetX}` : offsetX}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={offsetX}
                        onChange={(e) => setOffsetX(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Vertical Position Offset */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-600">
                        <span>Vertical Shift (Y)</span>
                        <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">
                          {offsetY > 0 ? `+${offsetY}` : offsetY}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={offsetY}
                        onChange={(e) => setOffsetY(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section D: Edge Optimization */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-800 tracking-wide uppercase flex items-center gap-2">
                        <Scissors className="h-4 w-4 text-neutral-400" />
                        Edge Quality
                      </label>
                    </div>

                    {/* Contraction (Choke) Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-600">
                        <span>Edge Contraction (Choke)</span>
                        <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">{edgeContraction.toFixed(1)}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.1"
                        value={edgeContraction}
                        onChange={(e) => setEdgeContraction(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Feathering Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-neutral-600">
                        <span>Edge Feathering (Smoothness)</span>
                        <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">{edgeFeather.toFixed(1)}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="0.1"
                        value={edgeFeather}
                        onChange={(e) => setEdgeFeather(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section E: Manual Brush Editor */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-800 tracking-wide uppercase flex items-center gap-2">
                        <Paintbrush className="h-4 w-4 text-neutral-400" />
                        Manual Mask Editor
                      </label>
                      <button
                        onClick={handleResetManualEdits}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
                        title="Restore original AI cutout"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset Brush Edits
                      </button>
                    </div>

                    {/* Mode Select Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setBrushMode('none')}
                        className={`flex flex-col items-center justify-center rounded-lg border py-2.5 text-[10px] font-semibold gap-1 transition-all ${brushMode === 'none'
                            ? 'border-neutral-900 bg-neutral-950 text-white shadow-xs'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50/80'
                          }`}
                      >
                        <MousePointer className="h-3.5 w-3.5" />
                        <span>Navigate</span>
                      </button>

                      <button
                        onClick={() => setBrushMode('erase')}
                        className={`flex flex-col items-center justify-center rounded-lg border py-2.5 text-[10px] font-semibold gap-1 transition-all ${brushMode === 'erase'
                            ? 'border-neutral-900 bg-neutral-950 text-white shadow-xs ring-1 ring-neutral-900'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50/80'
                          }`}
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        <span>Erase Bg</span>
                      </button>

                      <button
                        onClick={() => setBrushMode('restore')}
                        className={`flex flex-col items-center justify-center rounded-lg border py-2.5 text-[10px] font-semibold gap-1 transition-all ${brushMode === 'restore'
                            ? 'border-neutral-900 bg-neutral-950 text-white shadow-xs ring-1 ring-neutral-900'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50/80'
                          }`}
                      >
                        <Paintbrush className="h-3.5 w-3.5" />
                        <span>Restore Subject</span>
                      </button>
                    </div>

                    {/* Brush Size Slider */}
                    {brushMode !== 'none' && (
                      <div className="space-y-1.5 animate-fadeIn">
                        <div className="flex justify-between text-xs font-medium text-neutral-600">
                          <span>Brush Size</span>
                          <span className="font-mono text-[10px] bg-neutral-100 rounded-md px-1.5 py-0.5">{brushSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="80"
                          step="1"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Section F: Download Primary Button */}
                  <button
                    onClick={handleDownload}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 text-white font-semibold text-sm py-4 px-6 shadow-md hover:shadow-lg disabled:shadow-none hover:scale-[1.01] active:scale-[0.99] transition-all"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download Pas Foto</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* RIGHT COLUMN: PREVIEW AREA */}
          <section className={`${isExpanded ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-6 transition-all duration-300`}>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col h-full">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                    Studio Preview
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    Live studio viewport showing the background-swapped photo.
                  </p>
                </div>
                {originalImage && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50 transition-all shadow-3xs"
                    title={isExpanded ? 'Exit Full View' : 'Full View'}
                  >
                    {isExpanded ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        <span>Exit Full View</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span>Full View</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Canvas viewport container */}
              <div className="relative w-full">
                <CanvasPreview
                  ref={canvasRef}
                  originalImage={originalImage}
                  foregroundCanvas={foregroundCanvas}
                  bgColor={bgColor}
                  zoom={zoom}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  aspectRatio={aspectRatio}
                  isProcessing={isProcessing}
                  brushMode={brushMode}
                  brushSize={brushSize}
                  onPaint={handlePaint}
                  onPaintStart={handlePaintStart}
                  onPaintEnd={handlePaintEnd}
                  isExpanded={isExpanded}
                />

                {/* Floating Toolbar overlay in Full View Mode */}
                {isExpanded && !isProcessing && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white/95 backdrop-blur-md p-2.5 shadow-xl animate-fadeIn">

                    {/* Tool Swapper */}
                    <div className="flex items-center bg-neutral-100/80 p-0.5 rounded-lg border border-neutral-200/30">
                      <button
                        onClick={() => setBrushMode('none')}
                        className={`p-1.5 rounded-md transition-all ${brushMode === 'none'
                            ? 'bg-white text-neutral-950 shadow-2xs font-semibold'
                            : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        title="Navigate / Move"
                      >
                        <MousePointer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setBrushMode('erase')}
                        className={`p-1.5 rounded-md transition-all ${brushMode === 'erase'
                            ? 'bg-neutral-950 text-white shadow-2xs font-semibold'
                            : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        title="Erase Background"
                      >
                        <Eraser className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setBrushMode('restore')}
                        className={`p-1.5 rounded-md transition-all ${brushMode === 'restore'
                            ? 'bg-neutral-950 text-white shadow-2xs font-semibold'
                            : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        title="Restore Subject"
                      >
                        <Paintbrush className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Brush Size Slider (if not navigation mode) */}
                    {brushMode !== 'none' && (
                      <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
                        <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider shrink-0">Size:</span>
                        <input
                          type="range"
                          min="4"
                          max="80"
                          step="1"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-24 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-mono text-xs font-semibold text-neutral-800 w-8 text-right shrink-0">{brushSize}px</span>
                      </div>
                    )}

                    <div className="h-5 w-[1px] bg-neutral-200 shrink-0 mx-1" />

                    {/* Action buttons */}
                    <button
                      onClick={handleResetManualEdits}
                      className="p-1.5 rounded-md text-neutral-500 hover:text-red-600 transition-colors"
                      title="Reset Brush Edits"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setIsExpanded(false)}
                      className="p-1.5 rounded-md bg-neutral-950 hover:bg-neutral-800 text-white transition-colors"
                      title="Exit Full View"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Empty state placeholder when no photo has been uploaded */}
              {!originalImage && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/20">
                  <div className="h-16 w-16 rounded-full bg-neutral-50 border border-neutral-100 text-neutral-400 flex items-center justify-center shadow-3xs mb-4">
                    <ImageIcon className="h-7 w-7" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-800">No Image Uploaded</h3>
                  <p className="text-xs text-neutral-400 max-w-[280px] mt-1.5 leading-relaxed">
                    Upload your portrait photo on the left. The AI background segmenter will run automatically.
                  </p>
                </div>
              )}

              {/* Quick instructions and warnings */}
              {originalImage && (
                <div className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 flex gap-3 text-xs leading-relaxed text-neutral-500">
                  <HelpCircle className="h-4.5 w-4.5 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-700 block mb-0.5">Quick Guide:</span>
                    To align the photo with formal passport rules:
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-neutral-400">
                      <li>Use the <span className="font-medium text-neutral-600">Zoom</span> slider to make the head take up the upper-middle region.</li>
                      <li>Use the <span className="font-medium text-neutral-600">Vertical Offset (Y)</span> slider to adjust headroom.</li>
                      <li>Select <span className="font-medium text-neutral-600">Erase Bg</span> to paint away remaining background halos.</li>
                      <li>Select <span className="font-medium text-neutral-600">Restore Subject</span> to paint back ears or hair accidentally cut off by the AI.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// Helper to perform hardware-accelerated erosion on mask
function erodeMaskCanvas(rawMask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = rawMask.width;
  tempCanvas.height = rawMask.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return rawMask;

  tempCtx.drawImage(rawMask, 0, 0);

  if (radius <= 0) return tempCanvas;

  const shiftCanvas = document.createElement('canvas');
  shiftCanvas.width = rawMask.width;
  shiftCanvas.height = rawMask.height;
  const shiftCtx = shiftCanvas.getContext('2d');
  if (!shiftCtx) return tempCanvas;

  tempCtx.globalCompositeOperation = 'destination-in';

  // We intersect the mask with shifts in 8 directions to erode it
  const steps = Math.ceil(radius / 2);
  const stepSize = radius / steps;

  for (let s = 1; s <= steps; s++) {
    const r = s * stepSize;
    const shifts = [
      { x: -r, y: 0 },
      { x: r, y: 0 },
      { x: 0, y: -r },
      { x: 0, y: r },
      { x: -r, y: -r },
      { x: r, y: -r },
      { x: -r, y: r },
      { x: r, y: r },
    ];

    shifts.forEach((shift) => {
      shiftCtx.clearRect(0, 0, rawMask.width, rawMask.height);
      shiftCtx.drawImage(rawMask, shift.x, shift.y);
      tempCtx.drawImage(shiftCanvas, 0, 0);
    });
  }

  return tempCanvas;
}

// Helper to perform hardware-accelerated blurring/feathering on mask
function featherMaskCanvas(erodedMask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  if (radius <= 0) return erodedMask;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = erodedMask.width;
  tempCanvas.height = erodedMask.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return erodedMask;

  tempCtx.filter = `blur(${radius}px)`;
  tempCtx.drawImage(erodedMask, 0, 0);

  return tempCanvas;
}
