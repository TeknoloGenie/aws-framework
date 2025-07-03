import { Amplify } from 'aws-amplify';
import { Auth } from '@aws-amplify/auth';
import { AuthUser } from '../types';

// Configure Amplify
Amplify.configure({
  Auth: {
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
    userPoolWebClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
    mandatorySignIn: true,
    authenticationFlowType: 'USER_SRP_AUTH'
  }
});

export class AuthService {
  static async signUp(email: string, password: string, username: string, displayName: string) {
    try {
      const result = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          'custom:username': username,
          given_name: displayName.split(' ')[0] || displayName,
          family_name: displayName.split(' ').slice(1).join(' ') || ''
        }
      });

      return {
        success: true,
        data: result,
        needsConfirmation: !result.userConfirmed
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sign up failed'
      };
    }
  }

  static async confirmSignUp(email: string, code: string) {
    try {
      await Auth.confirmSignUp(email, code);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Confirmation failed'
      };
    }
  }

  static async signIn(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const cognitoUser = await Auth.signIn(email, password);
      
      if (cognitoUser.challengeName) {
        return {
          success: false,
          error: 'Additional authentication required'
        };
      }

      const session = await Auth.currentSession();
      const idToken = session.getIdToken();
      const accessToken = session.getAccessToken();
      const refreshToken = session.getRefreshToken();

      const user: AuthUser = {
        id: idToken.payload.sub,
        email: idToken.payload.email,
        username: idToken.payload['custom:username'] || email,
        displayName: `${idToken.payload.given_name || ''} ${idToken.payload.family_name || ''}`.trim() || email,
        role: idToken.payload['custom:role'] || 'user',
        accessToken: accessToken.getJwtToken(),
        refreshToken: refreshToken.getToken()
      };

      return { success: true, user };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sign in failed'
      };
    }
  }

  static async signOut() {
    try {
      await Auth.signOut();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sign out failed'
      };
    }
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const cognitoUser = await Auth.currentAuthenticatedUser();
      const session = await Auth.currentSession();
      const idToken = session.getIdToken();
      const accessToken = session.getAccessToken();
      const refreshToken = session.getRefreshToken();

      return {
        id: idToken.payload.sub,
        email: idToken.payload.email,
        username: idToken.payload['custom:username'] || idToken.payload.email,
        displayName: `${idToken.payload.given_name || ''} ${idToken.payload.family_name || ''}`.trim() || idToken.payload.email,
        role: idToken.payload['custom:role'] || 'user',
        accessToken: accessToken.getJwtToken(),
        refreshToken: refreshToken.getToken()
      };
    } catch (error) {
      return null;
    }
  }

  static async refreshSession(): Promise<string | null> {
    try {
      const session = await Auth.currentSession();
      return session.getAccessToken().getJwtToken();
    } catch (error) {
      return null;
    }
  }

  static async forgotPassword(email: string) {
    try {
      await Auth.forgotPassword(email);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password reset failed'
      };
    }
  }

  static async forgotPasswordSubmit(email: string, code: string, newPassword: string) {
    try {
      await Auth.forgotPasswordSubmit(email, code, newPassword);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password reset confirmation failed'
      };
    }
  }

  static async changePassword(oldPassword: string, newPassword: string) {
    try {
      const user = await Auth.currentAuthenticatedUser();
      await Auth.changePassword(user, oldPassword, newPassword);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Password change failed'
      };
    }
  }

  static async updateUserAttributes(attributes: Record<string, string>) {
    try {
      const user = await Auth.currentAuthenticatedUser();
      await Auth.updateUserAttributes(user, attributes);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Profile update failed'
      };
    }
  }

  static async deleteUser() {
    try {
      const user = await Auth.currentAuthenticatedUser();
      await Auth.deleteUser();
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Account deletion failed'
      };
    }
  }
}
