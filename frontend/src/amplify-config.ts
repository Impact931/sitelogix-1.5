import { Amplify } from 'aws-amplify';

// AWS Cognito configuration
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_tPkj4vb3A',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '7rsb6cnpp86cdgtv3h9j6c8t75',
    },
  },
};

// Configure Amplify
Amplify.configure(amplifyConfig);

export default amplifyConfig;
