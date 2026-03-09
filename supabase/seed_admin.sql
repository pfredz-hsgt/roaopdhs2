-- Run this in your Supabase SQL Editor to seed the Admin user
-- Create the auth user and remember their new ID
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- 1. Insert into auth.users (This is a simplified insert just to create the profile, 
  -- but generally you should create users via the dashboard or Auth API due to encryption).
  -- A safer way is to just use the Supabase Auth Dashboard to create 'admin@gmail.com' with 'admin'.
  -- THEN, take that new UUID and run the second part.
  
  -- Alternatively, just insert the profile if you already created the user manually:
  -- INSERT INTO public.profiles (id, name, email, role)
  -- VALUES ('YOUR-USER-UUID-HERE', 'Admin', 'admin@gmail.com', 'Issuer');
END $$;
