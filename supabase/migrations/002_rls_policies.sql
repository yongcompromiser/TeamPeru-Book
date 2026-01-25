-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Books policies
CREATE POLICY "Anyone can view books" ON books
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create books" ON books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update books" ON books
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete books" ON books
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Schedules policies
CREATE POLICY "Anyone can view schedules" ON schedules
  FOR SELECT USING (true);

CREATE POLICY "Admins can create schedules" ON schedules
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update schedules" ON schedules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete schedules" ON schedules
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendances policies
CREATE POLICY "Anyone can view attendances" ON attendances
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own attendance" ON attendances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance" ON attendances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attendance" ON attendances
  FOR DELETE USING (auth.uid() = user_id);

-- Discussions policies
CREATE POLICY "Anyone can view discussions" ON discussions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create discussions" ON discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discussions" ON discussions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions or admins" ON discussions
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Reviews policies
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews or admins" ON reviews
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Recaps policies
CREATE POLICY "Anyone can view recaps" ON recaps
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create recaps" ON recaps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recaps" ON recaps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recaps or admins" ON recaps
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Comments policies
CREATE POLICY "Anyone can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments or admins" ON comments
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
