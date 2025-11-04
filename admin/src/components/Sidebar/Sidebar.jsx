import React from 'react';
import { LogoSection } from './sections/LogoSection';
import { NavigationMenuSection } from './sections/NavigationMenuSection';
import { UserProfileSection } from './sections/UserProfileSection';

export const Sidebar = () => {
  return (
    <div className="w-64 bg-white flex flex-col h-full">
      <div className="p-4 flex-shrink-0">
        <LogoSection />
      </div>
      <div className="px-4 py-2 flex-shrink-0">
        <UserProfileSection />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <NavigationMenuSection />
      </div>
    </div>
  );
};

export default Sidebar;
