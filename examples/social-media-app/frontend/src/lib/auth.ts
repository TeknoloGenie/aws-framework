import { Amplify } from "aws-amplify";
import { signUp, signIn, signOut, confirmSignUp, resendSignUpCode, getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { AuthUser } from "../types";

// Configure Amplify
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
            userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
            loginWith: {
                email: true,
            }
        }
    }
});

export class AuthService {
    static async signUp(email: string, password: string, username: string, displayName: string) {
        try {
            const result = await signUp({
                username: email,
                password,
                options: {
                    userAttributes: {
                        email,
                        "custom:username": username,
                        given_name: displayName.split(" ")[0] || displayName,
                        family_name: displayName.split(" ").slice(1).join(" ") || ""
                    }
                }
            });

            return {
                success: true,
                data: result,
                needsConfirmation: !result.isSignUpComplete
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || "Sign up failed"
            };
        }
    }

    static async confirmSignUp(email: string, code: string) {
        try {
            await confirmSignUp({
                username: email,
                confirmationCode: code
            });

            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || "Confirmation failed"
            };
        }
    }

    static async signIn(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
        try {
            const result = await signIn({
                username: email,
                password
            });

            if (result.isSignedIn) {
                const user = await this.getCurrentUser();
                if (user) {
                    return { success: true, user };
                }
            }

            return {
                success: false,
                error: "Sign in incomplete"
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || "Sign in failed"
            };
        }
    }

    static async signOut() {
        try {
            await signOut();
            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || "Sign out failed"
            };
        }
    }

    static async getCurrentUser(): Promise<AuthUser | null> {
        try {
            const user = await getCurrentUser();
            const session = await fetchAuthSession();
            
            // Extract user attributes from the session tokens
            const idToken = session.tokens?.idToken;
            const accessToken = session.tokens?.accessToken;
            
            if (!idToken || !accessToken) {
                return null;
            }

            const payload = idToken.payload;
            
            return {
                id: payload.sub as string,
                email: payload.email as string,
                username: payload["custom:username"] as string || payload.email as string,
                displayName: `${payload.given_name || ""} ${payload.family_name || ""}`.trim() || payload.email as string,
                role: payload["custom:role"] as string || "user",
                accessToken: accessToken.toString(),
                refreshToken: session.tokens?.refreshToken?.toString() || ""
            };
        } catch (error) {
            return null;
        }
    }

    static async refreshSession(): Promise<string | null> {
        try {
            const session = await fetchAuthSession();
            return session.tokens?.accessToken?.toString() || null;
        } catch (error) {
            return null;
        }
    }

    // Note: These methods would need to be implemented with the new v6 API
    // For now, returning basic implementations
    static async forgotPassword(email: string) {
        return {
            success: false,
            error: "Not implemented in v6 yet"
        };
    }

    static async forgotPasswordSubmit(email: string, code: string, newPassword: string) {
        return {
            success: false,
            error: "Not implemented in v6 yet"
        };
    }

    static async changePassword(oldPassword: string, newPassword: string) {
        return {
            success: false,
            error: "Not implemented in v6 yet"
        };
    }

    static async updateUserAttributes(attributes: Record<string, string>) {
        return {
            success: false,
            error: "Not implemented in v6 yet"
        };
    }

    static async deleteUser() {
        return {
            success: false,
            error: "Not implemented in v6 yet"
        };
    }
}
