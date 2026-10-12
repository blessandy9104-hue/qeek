import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliIdentity = definePlugin({
  name: 'zoveli-identity',
  description: 'Identity and authentication management',

  setup(ctx) {
    ctx.register('identity-providers', {
      local: { type: 'local', name: 'Local Account' },
      github: { type: 'oauth', name: 'GitHub', clientId: process.env.GITHUB_CLIENT_ID },
      google: { type: 'oauth', name: 'Google', clientId: process.env.GOOGLE_CLIENT_ID },
      microsoft: { type: 'oauth', name: 'Microsoft', clientId: process.env.MICROSOFT_CLIENT_ID }
    });

    ctx.register('identity-config', {
      defaultProvider: 'local',
      sessionDuration: 86400000, // 24h
      refreshThreshold: 3600000, // 1h
      mfa: { enabled: false, methods: ['totp', 'email'] }
    });

    ctx.register('identity-tools', [
      {
        name: 'identity_login',
        description: 'Login with provider',
        parameters: {
          type: 'object',
          properties: { provider: { type: 'string' }, redirectUrl: { type: 'string' } },
          required: ['provider']
        }
      },
      {
        name: 'identity_logout',
        description: 'Logout current session',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'identity_profile',
        description: 'Get current user profile',
        parameters: { type: 'object', properties: {} }
      }
    ]);
  }
});

export default zoveliIdentity;

