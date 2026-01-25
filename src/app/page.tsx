import Link from 'next/link';
import { BookOpen, Users, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">독서토론</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">로그인</Button>
            </Link>
            <Link href="/signup">
              <Button>시작하기</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            함께 읽고, 함께 나누는
            <br />
            <span className="text-blue-600">독서토론 모임</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            책을 통해 생각을 나누고 깊이 있는 대화를 나눠보세요.
            <br />
            모임 일정 관리부터 발제, 독후감, 후기까지 한 곳에서 관리할 수 있습니다.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">무료로 시작하기</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                로그인
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">
          <FeatureCard
            icon={Calendar}
            title="모임 일정 관리"
            description="모임 일정을 등록하고 참석 여부를 관리하세요."
          />
          <FeatureCard
            icon={MessageSquare}
            title="발제 및 토론"
            description="토론 주제를 미리 공유하고 깊이 있는 대화를 준비하세요."
          />
          <FeatureCard
            icon={BookOpen}
            title="독후감 작성"
            description="책을 읽은 후 소감을 기록하고 공유하세요."
          />
          <FeatureCard
            icon={Users}
            title="모임 후기"
            description="모임의 순간들을 사진과 함께 기록하세요."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t border-gray-200">
        <p className="text-center text-gray-600 text-sm">
          © 2025 독서토론 모임. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
