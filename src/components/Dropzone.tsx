'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileImage, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
}

export default function Dropzone({ onFileSelect }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = (file: File | undefined) => {
    if (!file) return;

    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG or JPEG).');
      return;
    }

    // Check if it is a valid format (PNG or JPEG)
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Only PNG and JPEG formats are supported for passport photo creation.');
      return;
    }

    // Check file size (limit to 12MB to avoid client memory limits)
    if (file.size > 12 * 1024 * 1024) {
      setError('Image is too large. Please upload an image under 12MB.');
      return;
    }

    setError(null);
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    validateAndProcessFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndProcessFile(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragActive
            ? 'border-neutral-900 bg-neutral-50/80 scale-[0.99] shadow-inner'
            : 'border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm hover:scale-[1.005]'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/jpg"
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          {/* Upload Icon Container */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-50 border border-neutral-100 text-neutral-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-neutral-900 group-hover:text-white shadow-sm">
            <Upload className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-800">
              Upload your photo
            </h3>
            <p className="text-xs text-neutral-400 max-w-[240px] mx-auto leading-relaxed">
              Drag and drop your image here, or <span className="font-semibold text-neutral-800 underline decoration-neutral-300 decoration-2 underline-offset-2">browse</span> your device.
            </p>
          </div>

          {/* Formats info */}
          <div className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/50 px-3 py-1.5 text-[10px] font-medium text-neutral-400">
            <FileImage className="h-3.5 w-3.5 text-neutral-400" />
            <span>PNG, JPEG (Max. 12MB)</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-600 animate-fadeIn">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
          <p className="font-medium leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  );
}
