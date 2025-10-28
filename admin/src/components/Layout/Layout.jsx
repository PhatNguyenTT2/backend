import React from 'react';
import { SidebarSection } from './sections/SidebarSection';
import { MainContentSection } from './sections/MainContentSection';

export const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <SidebarSection />
      <MainContentSection>{children}</MainContentSection>
    </div>
  );
};
