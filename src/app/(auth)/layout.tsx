import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <BookOpen className="w-10 h-10 text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">독서토론</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
