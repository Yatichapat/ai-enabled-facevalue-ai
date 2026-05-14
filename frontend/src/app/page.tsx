'use client';

import { AlertCircle, Camera, CheckCircle2, CloudUpload, Loader2, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import { analyzeFaces, type AnalyzeResponse } from './lib/api';
import ResultView from './components/ResultView';

type UploadMessage = {
  type: 'success' | 'error' | 'info';
  text: string;
};

const getUploadPhotoLabel = (type: 'face' | 'reference') => (
  type === 'face' ? 'Your photo' : 'Reference photo'
);

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [faceDataUrl, setFaceDataUrl] = useState<string | null>(null);
  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadType, setUploadType] = useState<'face' | 'reference'>('face');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<UploadMessage | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);

  const clearStoredUploadImages = () => {
    localStorage.removeItem('saved_face_data_url');
    localStorage.removeItem('saved_reference_data_url');
  };

  const clearUploadedImages = () => {
    setFaceFile(null);
    setReferenceFile(null);
    setFaceDataUrl(null);
    setReferenceDataUrl(null);
    setPendingFile(null);
    setPendingPreview(null);
    setShowPreview(false);
    setAnalysisError(null);
    setUploadMessage(null);
    setAnalysisResult(null);
    clearStoredUploadImages();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const dataUrlToFile = async (dataUrl: string, filename: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  const isDataUrlLikelyBlack = async (dataUrl: string) => {
    const imageElement = new Image();
    imageElement.src = dataUrl;

    await new Promise<void>((resolve, reject) => {
      imageElement.onload = () => resolve();
      imageElement.onerror = () => reject(new Error('Invalid image data URL'));
    });

    const width = imageElement.naturalWidth || imageElement.width;
    const height = imageElement.naturalHeight || imageElement.height;
    if (!width || !height) {
      return true;
    }

    const canvasElement = document.createElement('canvas');
    canvasElement.width = width;
    canvasElement.height = height;
    const context = canvasElement.getContext('2d');
    if (!context) {
      return false;
    }

    context.drawImage(imageElement, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let totalLuminance = 0;
    let sampledPixels = 0;
    let darkPixels = 0;
    const step = Math.max(16, Math.floor(pixels.length / 12000));

    for (let index = 0; index < pixels.length; index += step) {
      const r = pixels[index] ?? 0;
      const g = pixels[index + 1] ?? 0;
      const b = pixels[index + 2] ?? 0;
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

  React.useEffect(() => {
    localStorage.removeItem('saved_face_data_url');
    localStorage.removeItem('saved_reference_data_url');
  }, []);

  React.useEffect(() => {
    const capturedData = localStorage.getItem('face_capture_data_url');
    if (!capturedData) {
      return;
    }

    const setCapturedFile = async () => {
      try {
        const capturedLooksBlack = await isDataUrlLikelyBlack(capturedData);
        if (!capturedLooksBlack) {
          const capturedFile = await dataUrlToFile(capturedData, 'captured-face.jpg');
          setFaceFile(capturedFile);
          setFaceDataUrl(capturedData);
        } else {
          setUploadMessage({
            type: 'error',
            text: 'Your photo has an issue: The captured image looked invalid or too dark. Please take another photo.',
          });
        }
      } catch {
        setFaceFile(null);
        setFaceDataUrl(null);
        setUploadMessage({
          type: 'error',
          text: 'Your photo has an issue: The captured image could not be loaded. Please take another photo.',
        });
      }
      localStorage.removeItem('face_capture_data_url');
    };

    void setCapturedFile();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg'];
      if (validTypes.includes(file.type)) {
        setAnalysisError(null);
        setUploadMessage({
          type: 'success',
          text: `${getUploadPhotoLabel(uploadType)} is ready to preview: ${file.name}.`,
        });
        setPendingFile(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setPendingPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
        setShowPreview(true);
      } else {
        setPendingFile(null);
        setPendingPreview(null);
        setShowPreview(false);
        setAnalysisError(null);
        setUploadMessage({
          type: 'error',
          text: `${getUploadPhotoLabel(uploadType)} has an issue: Unsupported file format. Please upload a PNG or JPG image.`,
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleUpload = () => {
    if (!pendingFile || !pendingPreview) {
      return;
    }

    if (uploadType === 'face') {
      setFaceFile(pendingFile);
      setFaceDataUrl(pendingPreview);
      setUploadMessage({
        type: 'success',
        text: 'Your photo was added successfully.',
      });
    } else {
      setReferenceFile(pendingFile);
      setReferenceDataUrl(pendingPreview);
      setUploadMessage({
        type: 'success',
        text: 'Reference photo was added successfully.',
      });
    }

    setAnalysisError(null);
    setPendingFile(null);
    setPendingPreview(null);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closePreview = () => {
    setPendingFile(null);
    setPendingPreview(null);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileUpload = (type: 'face' | 'reference') => {
    setUploadType(type);
    setAnalysisError(null);
    setUploadMessage(null);
    fileInputRef.current?.click();
  };

  const handleStartAnalyzing = async () => {
    if (!faceFile || !referenceFile) {
      setAnalysisError('Please upload both your face image and a reference image first.');
      setUploadMessage(null);
      return;
    }

    setAnalysisError(null);
    setUploadMessage({ type: 'info', text: 'Analyzing both images now.' });
    setAnalysisResult(null);
    setIsAnalyzing(true);

    try {
      const result = await analyzeFaces(faceFile, referenceFile);
      setAnalysisResult(result);
      setUploadMessage({ type: 'success', text: 'Prediction result is ready.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to analyze right now';
      setAnalysisError(message);
      setUploadMessage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-[#f8d0d6] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>
      <div className="absolute bottom-0 right-[-10%] w-[500px] h-[500px] bg-[#fceac2] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center py-16 px-6">
          {analysisResult ? (
            <div className="w-full mt-4">
              <ResultView
                faceImageUrl={faceDataUrl || ''}
                referenceImageUrl={referenceDataUrl || ''}
                analysisResult={analysisResult}
                onBack={clearUploadedImages}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-8 md:gap-12 w-full max-w-6xl justify-center mb-16">
                {/* Card 1 - Camera */}
                <div className="flex w-full flex-col gap-3 md:w-[500px]">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8f6d54]">Your Photo</p>
                  <div 
                    onClick={() => {
                      if (!faceDataUrl) {
                        router.push('/camera');
                      }
                    }}
                    className="cursor-pointer bg-[#fdf3db]/90 border-[3px] border-dashed border-[#c0862a] rounded-md overflow-hidden aspect-square md:aspect-auto w-full md:h-[500px] hover:shadow-lg transition-shadow flex flex-col items-center justify-center"
                  >
                    {faceDataUrl ? (
                      <div className="w-full h-full relative group">
                        <img src={faceDataUrl} alt="Face" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openFileUpload('face');
                            }}
                            className="opacity-0 group-hover:opacity-100 bg-white border-[1px] border-[#a4947f] rounded-xl py-2 px-6 shadow-md font-serif text-[#8f6d54]"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
                        <h2 className="text-lg font-bold mb-10 text-[#1a1a1a]">Tap to take a photo</h2>
                        
                        <div className="w-full flex items-center mb-10 px-8">
                          <div className="flex-1 border-t border-[#e2d5d5]"></div>
                          <span className="px-4 text-xs font-semibold text-[#a89b9b] uppercase tracking-widest">OR</span>
                          <div className="flex-1 border-t border-[#e2d5d5]"></div>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openFileUpload('face');
                          }}
                          className="cursor-pointer bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-10 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-xl"
                        >
                          Upload
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card 2 - Reference Upload */}
                <div className="flex w-full flex-col gap-3 md:w-[500px]">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9c6d6d]">Reference Photo</p>
                  <div 
                    onClick={() => {
                      if (!referenceDataUrl) {
                        openFileUpload('reference');
                      }
                    }}
                    className="cursor-pointer bg-[#fae7e7]/90 border-[3px] border-dashed border-[#dea0a0] rounded-md overflow-hidden aspect-square md:aspect-auto w-full md:h-[500px] hover:shadow-lg transition-shadow flex flex-col items-center justify-center"
                  >
                    {referenceDataUrl ? (
                      <div className="w-full h-full relative group">
                        <img src={referenceDataUrl} alt="Reference" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openFileUpload('reference');
                            }}
                            className="opacity-0 group-hover:opacity-100 bg-white border-[1px] border-[#a4947f] rounded-xl py-2 px-6 shadow-md font-serif text-[#8f6d54]"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <CloudUpload size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
                        <h2 className="text-lg font-bold text-[#1a1a1a]">Tap to upload reference</h2>
                        <p className="text-xs text-[#a09494] mb-2 mt-1 font-medium tracking-wide">PNG or JPG</p>
                      
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartAnalyzing}
                disabled={isAnalyzing}
                className="cursor-pointer bg-white border-[1px] border-[#a4947f] rounded-2xl py-4 w-[280px] sm:w-[400px] md:w-[500px] shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-2xl tracking-wide flex items-center justify-center gap-3 mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAnalyzing && <Loader2 size={22} className="animate-spin" />}
                {isAnalyzing ? 'Analyzing...' : 'Start Analyzing'}
              </button>

              {uploadMessage && (
                <div
                  role={uploadMessage.type === 'error' ? 'alert' : 'status'}
                  className={`mt-6 flex w-full max-w-xl items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                    uploadMessage.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : uploadMessage.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-[#e7d9c8] bg-[#fff7ef] text-[#8f6d54]'
                  }`}
                >
                  {uploadMessage.type === 'error' ? (
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  ) : uploadMessage.type === 'success' ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  ) : (
                    <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" />
                  )}
                  <span>{uploadMessage.text}</span>
                </div>
              )}

              {analysisError && (
                <div role="alert" className="mt-6 flex w-full max-w-xl items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Upload Preview Modal */}
      {showPreview && pendingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[#1a1a1a]">
                Confirm {uploadType === 'face' ? 'Face' : 'Reference'} Upload
              </h3>
              <button
                onClick={closePreview}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {pendingPreview ? (
              <div className="mb-4 w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={pendingPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full aspect-square bg-gray-100 rounded-lg mb-4">
                <div className="text-center">
                  <CloudUpload size={48} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500 font-medium text-sm">{pendingFile.name}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closePreview}
                className="flex-1 bg-white border-[1px] border-[#a4947f] rounded-lg py-2 px-4 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54]"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 bg-[#dea0a0] border-[1px] border-[#dea0a0] rounded-lg py-2 px-4 shadow-md hover:shadow-lg transition-shadow font-serif text-white"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}
