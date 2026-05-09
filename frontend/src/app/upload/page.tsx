'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CloudUpload, X } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
        
        // Create preview for images
        if (file.type !== 'application/pdf') {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreview(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setPreview(null);
        }
      } else {
        alert('Please select a PNG, JPG, or PDF file');
        setSelectedFile(null);
        setPreview(null);
      }
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      // Here you would typically upload the file to your backend
      console.log('Uploading file:', selectedFile);
      // For now, navigate back to home after "upload"
      router.push('/');
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          <div className="w-full max-w-2xl">
            {/* Header */}
            <div className="flex items-center mb-8">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-[#8f6d54] hover:text-[#a0804a] transition-colors"
              >
                <ArrowLeft size={24} />
                <span className="font-serif text-lg">Back</span>
              </button>
            </div>

            {/* Upload Area */}
            <div className="bg-[#fae7e7] border-[3px] border-dashed border-[#dea0a0] rounded-md p-10 bg-opacity-90">
              {selectedFile ? (
                <div className="flex flex-col items-center gap-6">
                  {preview ? (
                    <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-full aspect-square bg-gray-100 rounded-lg">
                      <div className="text-center">
                        <CloudUpload size={48} className="mx-auto mb-2 text-[#dea0a0]" />
                        <p className="text-[#a09494] font-medium">{selectedFile.name}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={clearSelection}
                      className="flex-1 bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-6 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-lg"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleUpload}
                      className="flex-1 bg-[#dea0a0] border-[1px] border-[#dea0a0] rounded-xl py-3 px-6 shadow-md hover:shadow-lg transition-shadow font-serif text-white text-lg"
                    >
                      Upload
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center cursor-pointer py-12"
                >
                  <CloudUpload size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
                  <h2 className="text-lg font-bold text-[#1a1a1a] mb-2">Tap to upload</h2>
                  <p className="text-xs text-[#a09494] mb-6 font-medium tracking-wide">PNG, JPG or PDF</p>
                  
                  <div className="w-full flex items-center mb-6 px-8">
                    <div className="flex-1 border-t border-[#e2d5d5]"></div>
                    <span className="px-4 text-xs font-semibold text-[#a89b9b] uppercase tracking-widest">OR</span>
                    <div className="flex-1 border-t border-[#e2d5d5]"></div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-10 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-xl"
                  >
                    Choose File
                  </button>
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
