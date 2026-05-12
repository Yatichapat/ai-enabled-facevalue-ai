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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/jpeg');
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
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={capturePhoto}
                    className="flex items-center justify-center gap-2 bg-[#c0862a] border-[1px] border-[#c0862a] rounded-xl py-3 px-8 shadow-md hover:shadow-lg transition-shadow font-serif text-white text-lg w-full"
                  >
                    <Camera size={20} />
                    Capture Photo
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
