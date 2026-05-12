import React from 'react';
import { Flower, User } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="bg-[#7b5f49] px-6 md:px-12 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <div className="text-white bg-[#e38d9a] rounded-full p-1.5 shadow-inner">
          <Flower size={32} strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl ml-2 md:text-3xl font-serif text-[#fefdfb] font-medium tracking-wide">
          FaceValue AI
        </h1>
      </div>
      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white shadow-md text-[#7b5f49]">
        <User size={22} strokeWidth={2} />
      </div>
    </header>
  );
}
