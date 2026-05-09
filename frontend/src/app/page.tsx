import { Camera, CloudUpload } from 'lucide-react';
import React from 'react';
import Navbar from './components/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-[#f8d0d6] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>
      <div className="absolute bottom-0 right-[-10%] w-[500px] h-[500px] bg-[#fceac2] rounded-full filter blur-[100px] opacity-60 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center py-16 px-6">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 w-full max-w-6xl justify-center mb-16">
            {/* Card 1 */}
            <div className="bg-[#fdf3db] border-[3px] border-dashed border-[#c0862a] rounded-md p-10 flex flex-col items-center justify-center aspect-square md:aspect-auto w-full md:w-[500px] md:h-[500px] bg-opacity-90">
              <Camera size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
              <h2 className="text-lg font-bold mb-10 text-[#1a1a1a]">Tap to take a photo</h2>
              
              <div className="w-full flex items-center mb-10 px-8">
                <div className="flex-1 border-t border-[#e2d5d5]"></div>
                <span className="px-4 text-xs font-semibold text-[#a89b9b] uppercase tracking-widest">OR</span>
                <div className="flex-1 border-t border-[#e2d5d5]"></div>
              </div>

              <button className="bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-10 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-xl">
                Upload
              </button>
            </div>

            {/* Card 2 */}
            <div className="bg-[#fae7e7] border-[3px] border-dashed border-[#dea0a0] rounded-md p-10 flex flex-col items-center justify-center aspect-square md:aspect-auto w-full md:w-[500px] md:h-[500px] bg-opacity-90">
              <CloudUpload size={56} strokeWidth={1.5} className="mb-4 text-[#222]" />
              <h2 className="text-lg font-bold text-[#1a1a1a]">Tap to upload reference</h2>
              <p className="text-xs text-[#a09494] mb-10 mt-1 font-medium tracking-wide">PNG, JPG or PDF</p>
              
              <div className="w-full flex items-center mb-10 px-8">
                <div className="flex-1 border-t border-[#e2d5d5]"></div>
                <span className="px-4 text-xs font-semibold text-[#a89b9b] uppercase tracking-widest">OR</span>
                <div className="flex-1 border-t border-[#e2d5d5]"></div>
              </div>

              <button className="bg-white border-[1px] border-[#a4947f] rounded-xl py-3 px-10 shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-xl">
                Upload
              </button>
            </div>
          </div>

          {/* Start Button */}
          <button className="bg-white border-[1px] border-[#a4947f] rounded-2xl py-4 w-[280px] sm:w-[400px] md:w-[500px] shadow-md hover:shadow-lg transition-shadow font-serif text-[#8f6d54] text-2xl tracking-wide flex justify-center mx-auto">
            Start Analyzing
          </button>
        </main>
      </div>
    </div>
  );
}
