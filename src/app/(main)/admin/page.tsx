'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Users, BookOpen, Calendar, MessageSquare, PenTool, Camera, Shield } from 'lucide-react';
import { Profile } from '@/types';

export default function AdminPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState({
    users: 0,
    books: 0,
    schedules: 0,
    discussions: 0,
    reviews: 0,
    recaps: 0,
  });
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    // Fetch users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers((usersData as Profile[]) || []);

    // Fetch stats
    const [
      { count: userCount },
      { count: bookCount },
      { count: scheduleCount },
      { count: discussionCount },
      { count: reviewCount },
      { count: recapCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true }),
      supabase.from('discussions').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('recaps').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      users: userCount || 0,
      books: bookCount || 0,
      schedules: scheduleCount || 0,
      discussions: discussionCount || 0,
      reviews: reviewCount || 0,
      recaps: recapCount || 0,
    });
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    await fetchData();
    setIsModalOpen(false);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">관리자만 접근할 수 있습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">관리자</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="회원" value={stats.users} icon={Users} />
        <StatCard title="책" value={stats.books} icon={BookOpen} />
        <StatCard title="일정" value={stats.schedules} icon={Calendar} />
        <StatCard title="발제" value={stats.discussions} icon={MessageSquare} />
        <StatCard title="독후감" value={stats.reviews} icon={PenTool} />
        <StatCard title="후기" value={stats.recaps} icon={Camera} />
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            회원 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">회원</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">이메일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">역할</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">가입일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.avatar_url} name={user.name} size="sm" />
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                        {user.role === 'admin' ? '관리자' : '멤버'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsModalOpen(true);
                        }}
                        disabled={user.id === profile?.id}
                      >
                        역할 변경
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role Change Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="역할 변경"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={selectedUser.avatar_url} name={selectedUser.name} size="md" />
              <div>
                <p className="font-medium text-gray-900">{selectedUser.name}</p>
                <p className="text-sm text-gray-600">{selectedUser.email}</p>
              </div>
            </div>

            <p className="text-gray-600">
              현재 역할: <Badge variant={selectedUser.role === 'admin' ? 'info' : 'default'}>
                {selectedUser.role === 'admin' ? '관리자' : '멤버'}
              </Badge>
            </p>

            <div className="flex gap-3">
              {selectedUser.role === 'member' ? (
                <Button
                  onClick={() => handleRoleChange(selectedUser.id, 'admin')}
                >
                  관리자로 변경
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => handleRoleChange(selectedUser.id, 'member')}
                >
                  멤버로 변경
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                취소
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
