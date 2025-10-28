import React from 'react';

export const LogoSection = () => {
  const logoUrl = "https://c.animaapp.com/YP0auJCm/img/nest@2x.png";

  return (
    <div className="flex items-center py-2">
      <img src={logoUrl} alt="Nest Logo" className="h-10 w-auto" />
    </div>
  );
};
