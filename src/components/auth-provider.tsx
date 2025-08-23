
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  accessToken: null,
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener and checking redirect result');

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        console.log('[AuthProvider] Auth state changed:', !!firebaseUser);
        setUser(firebaseUser);
        
        if (!firebaseUser) {
          setAppUser(null);
          setAccessToken(null);
          sessionStorage.removeItem('github_access_token');
          setLoading(false);
        }
      });

    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('[AuthProvider] Redirect result found');
          const credential = GithubAuthProvider.credentialFromResult(result);
          if (credential) {
            const token = credential.accessToken;
            if (token) {
              console.log('[AuthProvider] GitHub access token obtained');
              setAccessToken(token);
              sessionStorage.setItem('github_access_token', token);
            }
          }
          setUser(result.user);
        } else {
            const storedToken = sessionStorage.getItem('github_access_token');
            if (storedToken) {
              console.log('[AuthProvider] Restored access token from storage');
              setAccessToken(storedToken);
            }
        }
      })
      .catch((error) => {
        console.error('[AuthProvider] Redirect result error:', error);
        toast({
          title: 'Authentication Error',
          description: error.message || 'Failed to complete GitHub authentication',
          variant: 'destructive'
        });
      })
      .finally(() => {
         // This is to make sure loading is set to false after redirect check, 
         // even if onAuthStateChanged hasn't fired yet.
         // But we should be careful to not set it to false too early.
      });

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
          if (doc.exists()) {
            setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
          } else {
            setAppUser(null); // User is authenticated but not in our DB yet
          }
          setLoading(false);
        },
        (error) => {
          console.error("[AuthProvider] Error fetching user data:", error);
          setAppUser(null);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
        // Only set loading to false if user is null (not just being checked)
        if (auth.currentUser === null) {
            setLoading(false);
        }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
};
