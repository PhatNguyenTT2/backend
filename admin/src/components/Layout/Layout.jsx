import React from 'react';
import { SidebarProvider } from '../../contexts/SidebarContext';
import { SidebarSection } from './sections/SidebarSection';
import { MainContentSection } from './sections/MainContentSection';

export const Layout = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <SidebarSection />
        <MainContentSection>{children}</MainContentSection>
      </div>
    </SidebarProvider>
  );
};
