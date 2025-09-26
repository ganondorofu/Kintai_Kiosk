
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isMemberOfOrg } from '@/lib/github';
import { getAllTeams, getAllUsers } from '@/lib/data-adapter';
import type { Team } from '@/types';
import type { GitHubUser } from '@/lib/oauth';

const formSchema = z.object({
  firstname: z.string().min(1, 'First name is required'),
  lastname: z.string().min(1, 'Last name is required'),
  teamId: z.string().min(1, 'Please select a team'),
  grade: z.coerce.number().min(1, 'Grade is required'),
});

type RegisterFormValues = z.infer<typeof formSchema>;

interface RegisterFormProps {
  user: GitHubUser;
  accessToken: string;
  token: string;
  cardId: string;
}

export default function RegisterForm({ user, accessToken, token, cardId }: RegisterFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const fetchedTeams = await getAllTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
        toast({
          title: "Error",
          description: "Could not load teams. Please try again later.",
          variant: "destructive",
        });
      }
    };
    fetchTeams();
  }, [toast]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: user.name?.split(' ')[0] || '',
      lastname: user.name?.split(' ')[1] || '',
      teamId: '',
      grade: undefined,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);

    // 0. Check if cardId is already registered (case-insensitive)
    try {
      const allUsers = await getAllUsers();
      const existingUser = allUsers.find(
        (u) => u.cardId?.toLowerCase() === cardId.toLowerCase()
      );
      if (existingUser) {
        toast({
          title: 'Registration Failed',
          description: 'This card is already registered to another user.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('[RegisterForm] Card ID check failed:', err);
      toast({
        title: 'Verification Error',
        description: 'Unable to verify card ID. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
    // 1. Verify GitHub Organization Membership
    const requiredOrg = process.env.NEXT_PUBLIC_GITHUB_ORG_NAME;
    const altOrg = process.env.NEXT_PUBLIC_GITHUB_ALT_ORG_NAME;
    const requiredOrgs = [requiredOrg, altOrg].filter(Boolean) as string[];

    if (requiredOrgs.length === 0) {
      toast({ title: 'Configuration Error', description: 'GitHub organization is not configured.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    let member = false;
    try {
      member = await isMemberOfOrg(accessToken, requiredOrgs);
    } catch (err: any) {
      console.error('[RegisterForm] GitHub org check failed:', err);
      toast({ title: 'Verification Error', description: 'Unable to verify GitHub organization membership. Please try again.', variant: 'destructive' });
      setLoading(false);
      return;
    }
    if (!member) {
      toast({ title: 'Access Denied', description: `You are not a member of the required GitHub organizations.`, variant: 'destructive' });
      setLoading(false);
      return;
    }

    try {
      const batch = writeBatch(db);

      // 2. Find the link request
      const linkRequestsRef = collection(db, 'link_requests');
      const q = query(linkRequestsRef, where('token', '==', token), where('status', '==', 'opened'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: 'Registration Failed', description: 'Invalid or expired registration link. Please try again from the kiosk.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const linkRequestDoc = querySnapshot.docs[0];

      // 3. Create the user document
      const userDocRef = doc(db, 'users', user.id.toString());
      batch.set(userDocRef, {
        uid: user.id.toString(),
        github: user.email || user.login,
        githubLogin: user.login,
        githubId: user.id,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        cardId: cardId,
        firstname: values.firstname,
        lastname: values.lastname,
        teamId: values.teamId,
        grade: values.grade,
        role: 'user', // Default role
        status: 'exit', // Default status
        lastStatusChangeAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 4. Update the link request
      batch.update(linkRequestDoc.ref, {
        status: 'done',
        uid: user.id.toString(),
        updatedAt: serverTimestamp(),
        cardId: cardId, // Make sure cardId is set here as well
      });

      // 5. Commit the batch
      await batch.commit();

      // Clear session storage token after successful use
      try { sessionStorage.removeItem('github_access_token'); } catch (e) {}

      toast({ title: 'Registration Successful!', description: 'You can now use your card to log attendance.' });

    } catch (e: any) {
       console.error('[RegisterForm] Registration error:', e);
       toast({ title: 'Registration Failed', description: e?.message || 'An unexpected error occurred. Please try again or contact an admin.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
   if (form.formState.isSubmitSuccessful) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Registration Complete!</CardTitle>
          <CardDescription>
            You can now close this window and use your NFC tag at the kiosk.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Your GitHub account is authenticated. Please provide a few more details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Taro" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Yamada" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade (e.g., 10 for 10th generation)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Registration
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
