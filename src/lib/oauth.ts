// GitHub OAuth 直接実装
import { signInWithRedirect, GithubAuthProvider } from "firebase/auth";
import { auth } from './firebase';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface OAuthTokens {
  access_token: string;
  token_type: string;
  scope: string;
}


// GitHub OAuth認証URLを生成
export const getGitHubAuthUrl = (redirectUri?: string): string => {
  const provider = new GithubAuthProvider();
  provider.addScope('read:user');
  provider.addScope('user:email');
  provider.addScope('read:org');
  
  if (redirectUri) {
    sessionStorage.setItem('oauth_redirect_uri', redirectUri);
  }

  // We don't return a URL, we trigger the redirect directly
  signInWithRedirect(auth, provider);

  // This function won't return a string now, but we keep the signature for type consistency
  // across the app. The redirect will happen before this is returned.
  return '';
};


// ランダムなstate値を生成（CSRF攻撃防止）
const generateRandomState = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// 認証コードをアクセストークンに交換
export const exchangeCodeForToken = async (code: string, state: string): Promise<OAuthTokens> => {
  const response = await fetch('/api/auth/github', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange code for token');
  }

  return response.json();
};

// GitHubユーザー情報を取得
export const getGitHubUser = async (accessToken: string): Promise<GitHubUser> => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  return response.json();
};

// GitHubユーザーのメールアドレスを取得（プライベートメールの場合）
export const getGitHubUserEmails = async (accessToken: string): Promise<Array<{email: string, primary: boolean, verified: boolean}>> => {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user emails');
  }

  return response.json();
};

// ローカルストレージに認証情報を保存
export const saveAuthData = (tokens: OAuthTokens, user: GitHubUser): void => {
  localStorage.setItem('oauth_tokens', JSON.stringify(tokens));
  localStorage.setItem('github_user', JSON.stringify(user));
};

// ローカルストレージから認証情報を取得
export const getStoredAuthData = (): { tokens: OAuthTokens | null, user: GitHubUser | null } => {
  try {
    const tokensStr = localStorage.getItem('oauth_tokens');
    const userStr = localStorage.getItem('github_user');
    
    return {
      tokens: tokensStr ? JSON.parse(tokensStr) : null,
      user: userStr ? JSON.parse(userStr) : null,
    };
  } catch (error) {
    console.error('Failed to parse stored auth data:', error);
    return { tokens: null, user: null };
  }
};

// 認証情報をクリア
export const clearAuthData = (): void => {
  localStorage.removeItem('oauth_tokens');
  localStorage.removeItem('github_user');
};

// トークンの有効性を確認
export const validateToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
};
