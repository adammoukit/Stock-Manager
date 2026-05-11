import React from 'react';

const Logo = ({ className = "h-8" }) => (
  <svg 
    viewBox="0 0 225 60" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    {/* K */}
    <path d="M 15 15 V 45 M 15 30 L 30 15 M 15 30 L 30 45" />
    
    {/* A */}
    <path d="M 40 45 L 50 15 L 60 45 M 44 33 H 56" />
    
    {/* B */}
    <path d="M 75 15 V 45 M 75 15 H 85 A 7.5 7.5 0 0 1 85 30 H 75 M 75 30 H 87 A 7.5 7.5 0 0 1 87 45 H 75" />
    
    {/* L */}
    <path d="M 110 15 V 45 H 125" />
    
    {/* L */}
    <path d="M 140 15 V 45 H 155" />
    
    {/* i (Tige raccourcie pour laisser place au gros point) */}
    <path d="M 170 25 V 45" />
    
    {/* X */}
    <path d="M 190 15 L 210 45 M 210 15 L 190 45" />
    
    {/* LE GROS POINT ORANGE DU 'i' */}
    <circle cx="170" cy="10" r="7.5" fill="#f77500" stroke="none" />
  </svg>
);

export default Logo;
