import React from 'react';
import CanvasBoard from './CanvasBoard';
import retroDesktopBg from '../assets/retro-desktop-bg.jpg';

const CanvasLayer: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-50"
      style={{
        backgroundImage: `url(${retroDesktopBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <CanvasBoard />
    </div>
  );
};

export default CanvasLayer;

