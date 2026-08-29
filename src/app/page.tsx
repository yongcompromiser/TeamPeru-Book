import Link from 'next/link';
import { BookOpen, Users, Calendar, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#faf8f5]/90 backdrop-blur-md border-b border-amber-100/50">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                팀 페루
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600">로그인</Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                  시작하기
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-24">
        <section className="relative overflow-hidden">
          {/* 떠다니는 배경 블롭 */}
          <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
            <div className="animate-blob absolute -top-10 left-[10%] h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />
            <div className="animate-blob absolute top-20 right-[8%] h-80 w-80 rounded-full bg-purple-300/30 blur-3xl" style={{ animationDelay: '3s' }} />
            <div className="animate-blob absolute bottom-0 left-[35%] h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" style={{ animationDelay: '6s' }} />
          </div>

          {/* 둥둥 떠다니는 책·반짝임 */}
          <div className="pointer-events-none absolute inset-0 -z-0 select-none" aria-hidden="true">
            <span className="animate-float absolute left-[12%] top-24 text-4xl opacity-70">📚</span>
            <span className="animate-float-slow absolute right-[14%] top-16 text-3xl opacity-70">📖</span>
            <span className="animate-pulse-soft absolute left-[22%] bottom-16 text-2xl">✨</span>
            <span className="animate-float-slow absolute right-[24%] bottom-24 text-3xl opacity-60">📕</span>
            <span className="animate-pulse-soft absolute right-[40%] top-10 text-xl" style={{ animationDelay: '1.2s' }}>✨</span>
          </div>

          <div className="container relative z-10 mx-auto px-6 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <div className="animate-fade-up inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-8">
                <Sparkles className="w-4 h-4 animate-pulse-soft" />
                팀 페루 독서토론
              </div>

              <h1 className="animate-fade-up text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight" style={{ animationDelay: '0.1s' }}>
                책으로 연결되는
                <br />
                <span className="animate-gradient bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                  우리의 이야기
                </span>
              </h1>

              <p className="animate-fade-up text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: '0.2s' }}>
                같은 책을 읽고 다른 생각을 나누며 성장하는 팀 페루 독서토론.
                <br />
                일정 관리부터 토론 기록까지, 모든 것을 한 곳에서.
              </p>

              <div className="animate-fade-up flex items-center justify-center gap-4" style={{ animationDelay: '0.3s' }}>
                <Link href="/signup">
                  <Button size="lg" className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-lg px-8 py-6 rounded-xl shadow-lg shadow-blue-500/25 transition-transform hover:scale-105">
                    무료로 시작하기
                    <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gradient-to-b from-amber-50/50 to-[#faf8f5] py-24">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                독서모임을 더 즐겁게
              </h2>
              <p className="text-gray-600">
                팀 페루가 제공하는 다양한 기능들을 만나보세요
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <FeatureCard
                icon={Calendar}
                title="일정 투표"
                description="모임 날짜를 투표로 정하고 일정을 관리하세요"
                color="blue"
                delay={0}
              />
              <FeatureCard
                icon={Users}
                title="모임 관리"
                description="발제, 평점, 토론 기록을 한눈에 확인하세요"
                color="indigo"
                delay={0.1}
              />
              <FeatureCard
                icon={BookOpen}
                title="책 목록"
                description="읽은 책과 읽을 책을 체계적으로 관리하세요"
                color="purple"
                delay={0.2}
              />
              <FeatureCard
                icon={MessageCircle}
                title="자유게시판"
                description="모임원들과 자유롭게 소통하세요"
                color="pink"
                delay={0.3}
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <div
              className="animate-gradient max-w-4xl mx-auto rounded-3xl p-12 text-center text-white relative overflow-hidden"
              style={{ backgroundImage: 'linear-gradient(120deg, #2563eb, #6d28d9, #4f46e5, #2563eb)' }}
            >
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:24px_24px]" />
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  지금 바로 시작하세요
                </h2>
                <p className="text-blue-100 mb-8 text-lg">
                  팀 페루와 함께 더 의미있는 독서를 경험해보세요
                </p>
                <Link href="/signup">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 rounded-xl">
                    무료로 가입하기
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-100/50 py-8">
        <div className="container mx-auto px-6">
          <p className="text-center text-gray-500 text-sm">
            © 2025 팀 페루 독서토론. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: 'blue' | 'indigo' | 'purple' | 'pink';
  delay?: number;
}) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/20',
    pink: 'from-pink-500 to-pink-600 shadow-pink-500/20',
  };

  return (
    <div
      className="animate-fade-up bg-[#fffdf9] rounded-2xl p-6 shadow-sm border border-amber-100/50 hover:shadow-lg hover:border-amber-200/50 hover:-translate-y-1 transition-all duration-300 group"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`w-14 h-14 bg-gradient-to-br ${colorMap[color]} rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
