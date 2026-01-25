import { MainLayout } from '@/components/layout/main-layout';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
