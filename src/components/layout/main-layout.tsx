'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { useAuth } from '@/hooks/use-auth';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        profile={profile}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <div className="flex">
        <Sidebar
          profile={profile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
