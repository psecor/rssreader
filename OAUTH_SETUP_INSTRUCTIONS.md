# Google OAuth Setup Instructions

Follow these steps to get your Google OAuth credentials:

## 1. Go to Google Cloud Console
Open: https://console.cloud.google.com/

## 2. Create or Select a Project
- Click on the project dropdown at the top
- Click "New Project"
- Enter project name: "RSS Reader" (or any name you prefer)
- Click "Create"
- Wait for the project to be created and select it

## 3. Enable Google+ API (Optional but recommended)
- In the left sidebar, go to "APIs & Services" > "Library"
- Search for "Google+ API"
- Click on it and click "Enable"

## 4. Configure OAuth Consent Screen
- Go to "APIs & Services" > "OAuth consent screen"
- Select "External" (unless you have a Google Workspace account)
- Click "Create"
- Fill in the required fields:
  - App name: "RSS Reader"
  - User support email: your email (secorp@gmail.com)
  - Developer contact: your email
- Click "Save and Continue"
- Click "Save and Continue" on Scopes (no need to add any)
- Add Test Users:
  - Click "Add Users"
  - Add: secorp@gmail.com
  - Click "Save and Continue"
- Click "Back to Dashboard"

## 5. Create OAuth Credentials
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "OAuth client ID"
- Application type: "Web application"
- Name: "RSS Reader Web Client"
- Authorized JavaScript origins:
  - Add: https://secorp.net:3444
- Authorized redirect URIs:
  - Add: https://secorp.net:3444/auth/google/callback
- Click "Create"

**IMPORTANT:** Use `https://secorp.net:3444`, NOT `localhost`! The app runs behind Apache proxy.

## 6. Copy Your Credentials
You'll see a popup with:
- **Client ID** (looks like: 123456789-abcdefg.apps.googleusercontent.com)
- **Client Secret** (looks like: GOCSPX-abcdefghijklmnop)

⚠️ **IMPORTANT:** Copy these now! You'll need them for the .env file.

## 7. What to Copy
Copy and save these values:
```
GOOGLE_CLIENT_ID="your-client-id-here"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

Once you have these, let me know and I'll help you configure the .env file!
