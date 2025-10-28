import React from 'react';

export const ProductListHeader = ({ itemCount = 29 }) => {
  return (
    <div className="text-gray-500 text-base">
      <span>We found </span>
      <span className="font-semibold text-emerald-600">{itemCount}</span>
      <span> items for you!</span>
    </div>
  );
};
