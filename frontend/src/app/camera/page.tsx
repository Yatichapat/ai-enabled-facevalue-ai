'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const waitForNextVideoFrame = (videoElement: HTMLVideoElement) =>
    new Promise<void>((resolve) => {
      if ('requestVideoFrameCallback' in videoElement) {
        (
          videoElement as HTMLVideoElement & {
            requestVideoFrameCallback: (callback: () => void) => number;
          }
        ).requestVideoFrameCallback(() => resolve());
        return;
      }

      requestAnimationFrame(() => resolve());
    });

  const isFrameLikelyBlack = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const frame = context.getImageData(0, 0, width, height).data;
    let totalLuminance = 0;
    let sampledPixels = 0;
    let darkPixels = 0;
    const step = Math.max(16, Math.floor(frame.length / 12000));

    for (let index = 0; index < frame.length; index += step) {
      const r = frame[index] ?? 0;
      const g = frame[index + 1] ?? 0;
      const b = frame[index + 2] ?? 0;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      totalLuminance += luminance;
      if (luminance < 20) {
        darkPixels += 1;
      }
      sampledPixels += 1;
    }

    const averageLuminance = sampledPixels > 0 ? totalLuminance / sampledPixels : 0;
    const darkRatio = sampledPixels > 0 ? darkPixels / sampledPixels : 1;

    return averageLuminance < 22 || darkRatio > 0.97;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch (playError) {
            console.error('Video play was interrupted:', playError);
          }
        };
        videoRef.current.oncanplay = () => {
          setIsCameraReady(true);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const capturePhoto = async () => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (videoElement && canvasElement) {
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;

      if (!width || !height || videoElement.readyState < 2) {
        alert('Camera is still loading. Please wait a moment and try again.');
        return;
      }

      if (videoElement.paused) {
        try {
          await videoElement.play();
        } catch (playError) {
          console.error('Unable to resume camera before capture:', playError);
        }
      }

      await waitForNextVideoFrame(videoElement);
      await waitForNextVideoFrame(videoElement);

      const context = canvasElement.getContext('2d');
      if (context) {
        canvasElement.width = width;
        canvasElement.height = height;
        context.drawImage(videoElement, 0, 0, width, height);

        if (isFrameLikelyBlack(context, width, height)) {
          alert('Captured frame looks too dark. Please wait a moment and try again.');
          return;
        }

        const imageData = canvasElement.toDataURL('image/jpeg', 0.95);
        if (imageData === 'data:,') {
          alert('Could not capture image. Please retake the photo.');
          return;
        }

        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const usePhoto = () => {
    if (capturedImage) {
      localStorage.setItem('face_capture_data_url', capturedImage);
    }
    router.push('/');
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-[#f8d0d6] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>
      <div className="absolute bottom-0 right-[-10%] w-[500px] h-[500px] bg-[#fceac2] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center py-16 px-6">
          <div className="w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center mb-8">
              <button
                onClick={() => {
                  stopCamera();
                  router.back();
                }}
                className="flex items-center gap-2 text-[#8f6d54] hover:text-[#a0804a] transition-colors"
              >
                <ArrowLeft size={24} />
                <span className="font-serif text-lg">Back</span>
              </button>
            </div>

            {/* Camera View */}
            <div className="bg-[#fdf3db] border-[3px] border-dashed border-[#c0862a] rounded-md p-6 bg-opacity-90">
              {capturedImage ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={retakePhoto}
                      className="flex-1 bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-6 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-lg"
                    >
                      Retake
                    </button>
                    <button
                      onClick={usePhoto}
                      className="flex-1 bg-[#c0862a] border-[1px] border-[#c0862a] rounded-xl py-3 px-6 shadow-md hover:shadow-lg transition-shadow font-serif text-white text-lg"
                    >
                      Use Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={capturePhoto}
                    disabled={!isCameraReady}
                    className="flex items-center justify-center gap-2 bg-[#c0862a] border-[1px] border-[#c0862a] rounded-xl py-3 px-8 shadow-md hover:shadow-lg transition-shadow font-serif text-white text-lg w-full"
                  >
                    <Camera size={20} />
                    {isCameraReady ? 'Capture Photo' : 'Preparing Camera...'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
