'use client';

import { Camera, CloudUpload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './components/Navbar';
import { analyzeFaces, type AnalyzeResponse } from './lib/api';
import ResultView from './components/ResultView';

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
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);

  const dataUrlToFile = async (dataUrl: string, filename: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  };

  React.useEffect(() => {
    const restoreSavedImages = async () => {
      const savedFace = localStorage.getItem('saved_face_data_url');
      const savedReference = localStorage.getItem('saved_reference_data_url');

      if (savedFace) {
        const file = await dataUrlToFile(savedFace, 'saved-face.jpg');
        setFaceFile(file);
        setFaceDataUrl(savedFace);
      }

      if (savedReference) {
        const file = await dataUrlToFile(savedReference, 'saved-reference.jpg');
        setReferenceFile(file);
        setReferenceDataUrl(savedReference);
      }
    };

    void restoreSavedImages();
  }, []);

  React.useEffect(() => {
    const capturedData = localStorage.getItem('face_capture_data_url');
    if (!capturedData) {
      return;
    }

    const setCapturedFile = async () => {
      const capturedFile = await dataUrlToFile(capturedData, 'captured-face.jpg');
      setFaceFile(capturedFile);
      setFaceDataUrl(capturedData);
      localStorage.setItem('saved_face_data_url', capturedData);
      localStorage.removeItem('face_capture_data_url');
    };

    void setCapturedFile();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg'];
      if (validTypes.includes(file.type)) {
        setPendingFile(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setPendingPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
        setShowPreview(true);
      } else {
        alert('Please select a PNG or JPG file');
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
      localStorage.setItem('saved_face_data_url', pendingPreview);
    } else {
      setReferenceFile(pendingFile);
      setReferenceDataUrl(pendingPreview);
      localStorage.setItem('saved_reference_data_url', pendingPreview);
    }

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
    fileInputRef.current?.click();
  };

  const handleStartAnalyzing = async () => {
    if (!faceFile || !referenceFile) {
      setAnalysisError('Please upload both your face image and a reference image first.');
      return;
    }

    setAnalysisError(null);
    setAnalysisResult(null);
    setIsAnalyzing(true);

    try {
      const result = await analyzeFaces(faceFile, referenceFile);
      setAnalysisResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to analyze right now';
      setAnalysisError(message);
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
                onBack={() => setAnalysisResult(null)}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-8 md:gap-12 w-full max-w-6xl justify-center mb-16">
                {/* Card 1 - Camera */}
                <div 
                  onClick={() => router.push('/camera')}
                  className="cursor-pointer bg-[#fdf3db] border-[3px] border-dashed border-[#c0862a] rounded-md p-10 flex flex-col items-center justify-center aspect-square md:aspect-auto w-full md:w-[500px] md:h-[500px] bg-opacity-90 hover:shadow-lg transition-shadow"
                >
                  <Camera size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
                  <h2 className="text-lg font-bold mb-10 text-[#1a1a1a]">Tap to take a photo</h2>
                  {faceFile && (
                    <p className="text-xs text-[#7b6a55] mb-4 font-medium">Selected: {faceFile.name}</p>
                  )}
                  
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
                </div>

                {/* Card 2 - Reference Upload */}
                <div 
                  onClick={() => openFileUpload('reference')}
                  className="cursor-pointer bg-[#fae7e7] border-[3px] border-dashed border-[#dea0a0] rounded-md p-10 flex flex-col items-center justify-center aspect-square md:aspect-auto w-full md:w-[500px] md:h-[500px] bg-opacity-90 hover:shadow-lg transition-shadow"
                >
                  <CloudUpload size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
                  <h2 className="text-lg font-bold text-[#1a1a1a]">Tap to upload reference</h2>
                  <p className="text-xs text-[#a09494] mb-2 mt-1 font-medium tracking-wide">PNG or JPG</p>
                  {referenceFile && (
                    <p className="text-xs text-[#8a6b6b] mb-8 font-medium">Selected: {referenceFile.name}</p>
                  )}
                  
                  <div className="w-full flex items-center mb-10 px-8">
                    <div className="flex-1 border-t border-[#e2d5d5]"></div>
                    <span className="px-4 text-xs font-semibold text-[#a89b9b] uppercase tracking-widest">OR</span>
                    <div className="flex-1 border-t border-[#e2d5d5]"></div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openFileUpload('reference');
                    }}
                    className="cursor-pointer bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-10 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-xl"
                  >
                    Upload
                  </button>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartAnalyzing}
                disabled={isAnalyzing}
                className="cursor-pointer bg-white border-[1px] border-[#a4947f] rounded-2xl py-4 w-[280px] sm:w-[400px] md:w-[500px] shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-2xl tracking-wide flex justify-center mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? 'Analyzing...' : 'Start Analyzing'}
              </button>

              {analysisError && (
                <p className="mt-6 text-sm text-red-600 font-medium">{analysisError}</p>
              )}
            </>
          )}
        </main>
      </div>

      {/* Upload Preview Modal */}
      {showPreview && pendingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
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
