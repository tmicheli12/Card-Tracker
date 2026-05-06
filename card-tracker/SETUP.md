# Card Tracker — Setup Guide

## Step 1: Create a GitHub Account
1. Go to github.com → click "Sign up"
2. Choose a username, enter your email, create a password
3. Verify your email

## Step 2: Push this project to GitHub
After creating your GitHub account, create a new repository:
1. Click the "+" icon → "New repository"
2. Name it "card-tracker", set it to Private
3. Click "Create repository"
4. GitHub will show you commands — run the ones under "push an existing repository"

From your terminal, in the card-tracker folder:
```
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/card-tracker.git
git push -u origin main
```

## Step 3: Create a Supabase Account
1. Go to supabase.com → click "Start your project"
2. Sign in with GitHub (easiest)
3. Click "New Project"
4. Name it "card-tracker", set a database password (save this!), choose a region close to you
5. Wait ~2 minutes for it to spin up

### Set up the database
1. In your Supabase project, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `supabase/schema.sql` from this project
4. Copy all the contents and paste into the SQL editor
5. Click "Run"

### Get your API keys
1. Go to Settings → API in your Supabase project
2. Copy the "Project URL" — this is your NEXT_PUBLIC_SUPABASE_URL
3. Copy the "anon public" key — this is your NEXT_PUBLIC_SUPABASE_ANON_KEY

## Step 4: Create a Vercel Account
1. Go to vercel.com → click "Sign Up"
2. Sign in with GitHub (easiest)
3. Click "Add New Project"
4. Find your "card-tracker" repository and click "Import"
5. Before clicking "Deploy", click "Environment Variables" and add:
   - Name: NEXT_PUBLIC_SUPABASE_URL → Value: (paste your Supabase URL)
   - Name: NEXT_PUBLIC_SUPABASE_ANON_KEY → Value: (paste your anon key)
6. Click "Deploy"

Vercel will give you a URL like `card-tracker-xyz.vercel.app` — that's your app!

## Step 5: Add to your phone's home screen
### iPhone
1. Open Safari and go to your Vercel URL
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" — it now acts like an app!

### Android
1. Open Chrome and go to your Vercel URL
2. Tap the three dots menu
3. Tap "Add to Home screen"

## Setting your PSA cost
1. Open the app
2. Tap Settings (gear icon on desktop, or navigate to /settings)
3. Enter your flat PSA grading cost per card
4. Save

That's it! Your app is live and accessible from any device.
