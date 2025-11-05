# Security Setup Instructions

## CRITICAL: Amplify Environment Variables

After the security incident on November 5th, 2025, all sensitive credentials have been moved to environment variables.

### Required Amplify Environment Variables

In the **AWS Amplify Console** → **Your App** → **Environment variables**, set:

```
VITE_SUPER_ADMIN_USERNAME=Jayson Rivas
VITE_SUPER_ADMIN_EMAIL=jayson@impactconsulting931.com
VITE_SUPER_ADMIN_PASSWORD=<NEW_SECURE_PASSWORD>
```

**IMPORTANT**:
1. The old password `Rivas123$` was exposed on GitHub and must be rotated immediately
2. Generate a new secure password (minimum 16 characters, include uppercase, lowercase, numbers, special characters)
3. Never commit passwords to git - use environment variables only

### Setting Environment Variables in Amplify

1. Go to: https://console.aws.amazon.com/amplify
2. Select your app: `sitelogix-1.5`
3. Go to: **App settings** → **Environment variables**
4. Click: **Manage variables**
5. Add the variables above
6. Click: **Save**
7. Redeploy the app

### Local Development

For local development, copy `frontend/.env.example` to `frontend/.env.local` and fill in your values:

```bash
cp frontend/.env.example frontend/.env.local
```

Then edit `.env.local` with your local credentials. This file is gitignored and will never be committed.

### Backend Environment Variables

Backend Lambda functions use AWS Systems Manager Parameter Store or AWS Secrets Manager for sensitive data like:
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- AWS credentials (automatically provided by Lambda execution role)

## Security Best Practices

1. **Never** commit `.env` files to git
2. **Never** hardcode passwords in source code
3. **Always** use environment variables for sensitive data
4. **Rotate** passwords immediately if exposed
5. **Use** AWS Secrets Manager for production secrets
6. **Enable** GitGuardian alerts on your repository

## Password Rotation Checklist

If a password is exposed:
- [ ] Generate new secure password
- [ ] Update Amplify environment variables
- [ ] Update any local .env.local files
- [ ] Redeploy application
- [ ] Verify login works with new password
- [ ] Notify team members
- [ ] Remove old password from git history (if needed)
