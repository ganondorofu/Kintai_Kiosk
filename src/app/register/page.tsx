'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import RegisterForm from '@/components/register-form';
import { getGitHubAuthUrl } from '@/lib/oauth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Github } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function RegisterContent() {
  const { user: authUser, loading: authLoading, accessToken } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get('token'), [searchParams]);
  const cardId = useMemo(() => searchParams.get('cardId'), [searchParams]);

  const handleLogin = () => {
    try {
      const authUrl = getGitHubAuthUrl(window.location.href);
      console.log('[Register] Redirecting to GitHub OAuth:', authUrl);
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('[Register] OAuth URL generation error:', error);
      toast({
        title: 'Login Failed',
        description: error?.message || 'Unable to initiate GitHub sign-in.',
        variant: 'destructive'
      });
    }
  };
  
  if (authLoading) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  if (authUser && accessToken && token && cardId) {
    return <RegisterForm user={authUser} accessToken={accessToken} token={token} cardId={cardId} />;
  }

  if (!token || !cardId) {
     return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-destructive">Invalid Link</CardTitle>
                <CardDescription>
                This registration link is invalid or has expired. Please try generating a new one from the kiosk.
                </CardDescription>
            </CardHeader>
        </Card>
     )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Register Your Card</CardTitle>
        <CardDescription>
          Sign in with your GitHub account to link it to your NFC card.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleLogin} 
          className="w-full gap-2"
          size="lg"
        >
          <Github className="h-5 w-5" />
          Continue with GitHub
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          You will be redirected to GitHub to authorize this application.
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Suspense fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading registration...</p>
          </div>
        }>
            <RegisterContent />
        </Suspense>
      </div>
    );
}
