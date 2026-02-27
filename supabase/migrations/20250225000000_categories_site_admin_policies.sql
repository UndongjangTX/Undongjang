-- Allow site admins to manage categories (insert, update, delete).
CREATE POLICY "Site admins can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));

CREATE POLICY "Site admins can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM site_admins sa WHERE sa.user_id = auth.uid()));
