'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { compressImage, readFileAsDataUrl } from '@/lib/imageUtils';

interface CameraViewProps {
  onCapture: (compressedDataUrl: string) => void;
  onError: (errorMessage: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onError }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Initialize camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing stream tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser. Please upload an image.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      console.warn('Camera access issue:', err);
      const msg =
        'Camera permission is required to take photos directly. You can also upload an image manually below.';
      setCameraError(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [stream]);

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Capture photo from canvas
  const handleCapture = async () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to create canvas context for capture.');
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Compress client-side for fast network payload
      const compressed = await compressImage(rawDataUrl);
      onCapture(compressed);
    } catch (err: unknown) {
      console.error('Capture error:', err);
      onError('Failed to capture photo. Please try uploading an image instead.');
    }
  };

  // Toggle front/rear camera
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // File upload fallback
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawDataUrl = await readFileAsDataUrl(file);
      const compressed = await compressImage(rawDataUrl);
      onCapture(compressed);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process selected file.';
      onError(errorMsg);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4">
      {/* Video Viewport Container */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-slate-300 space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-sm font-medium">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Viewfinder overlay target */}
            <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-3">
              <div className="text-[11px] font-semibold tracking-wider text-white/80 uppercase bg-black/40 backdrop-blur-md self-center px-3 py-1 rounded-full border border-white/10">
                Position MCQ in frame
              </div>
            </div>

            {/* Switch Camera Button (Top Right) */}
            <button
              onClick={toggleCamera}
              type="button"
              aria-label="Switch Camera"
              className="absolute top-3 right-3 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md transition-colors border border-white/10 active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}

        {isInitializing && (
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center text-white text-sm">
            <span>Accessing camera...</span>
          </div>
        )}
      </div>

      {/* Main Action Controls */}
      <div className="w-full flex flex-col items-center space-y-3 pt-2">
        {/* Shutter Capture Button */}
        {!cameraError && (
          <button
            onClick={handleCapture}
            disabled={isInitializing}
            type="button"
            aria-label="Capture MCQ Photo"
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 text-base transition-all disabled:opacity-50"
          >
            <Camera className="w-6 h-6" />
            <span>📷 Capture MCQ</span>
          </button>
        )}

        {/* Fallback Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          type="button"
          aria-label="Upload Image File"
          className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 font-medium rounded-xl border border-slate-700 flex items-center justify-center space-x-2 text-sm transition-all"
        >
          <Upload className="w-4 h-4 text-slate-400" />
          <span>Upload Image</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
