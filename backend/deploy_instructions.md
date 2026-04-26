# Deploying SahabNote Backend to Render (Free Tier)

This guide explains how to deploy the FastAPI backend to Render's free tier so your Chrome extension can sync notes over the internet.

## Prerequisites

- A GitHub account
- Your code pushed to a GitHub repository

## Steps

### 1. Create a Render Account

Go to [render.com](https://render.com) and sign up using your GitHub account.

### 2. Create a New Web Service

- Click **New +** → **Web Service**
- Connect your GitHub repository
- Select the repository containing the backend code

### 3. Configure the Service

- **Name**: `sahabnote-backend` (or any name)
- **Region**: Choose the closest to you
- **Branch**: `main` (or your default branch)
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free

### 4. Set Environment Variables (Optional)

If you need to set environment variables (like `DATABASE_URL`), add them in the **Environment** section.

### 5. Deploy

Click **Create Web Service**. Render will build and deploy your app. The first deployment may take a few minutes.

### 6. Get Your Server URL

Once deployed, Render will give you a URL like `https://sahabnote-backend.onrender.com`. Use this URL in the Chrome extension settings.

## Updating the Chrome Extension

1. Open the extension options page
2. Set **Server URL** to `https://sahabnote-backend.onrender.com`
3. Register or login to get your sync key
4. Start syncing!

## Notes

- The free tier spins down after 15 minutes of inactivity. The first request after inactivity may take 30-60 seconds to wake up.
- Render provides a free PostgreSQL database if you need it (optional).
- For production use, consider upgrading to a paid plan.
