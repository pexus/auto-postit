import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const setupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SetupFormData = z.infer<typeof setupSchema>;

export function SetupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
  });

  const password = watch('password', '');

  // Check if setup is required
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await api.get<{ setupRequired: boolean }>('/auth/setup-status');
        setSetupRequired(response.data.setupRequired);
        if (!response.data.setupRequired) {
          navigate('/login');
        }
      } catch {
        // If error, assume setup might be needed
      } finally {
        setIsCheckingSetup(false);
      }
    };
    checkSetup();
  }, [navigate]);

  const onSubmit = async (data: SetupFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
        name: data.name,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const passwordChecks = {
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };

  if (isCheckingSetup) {
    return (
      <div className="bg-background rounded-lg border p-6 shadow-sm flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!setupRequired) {
    return (
      <div className="bg-background rounded-lg border p-6 shadow-sm">
        <p className="text-center text-muted-foreground">
          Account already exists.{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg border p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Welcome to Auto-PostIt</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Create your account to get started
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            {...register('name')}
            disabled={isLoading}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••••••"
            {...register('password')}
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
          
          {/* Password requirements */}
          {password && (
            <div className="space-y-1 mt-2">
              <PasswordCheck check={passwordChecks.length} label="At least 12 characters" />
              <PasswordCheck check={passwordChecks.lowercase} label="One lowercase letter" />
              <PasswordCheck check={passwordChecks.uppercase} label="One uppercase letter" />
              <PasswordCheck check={passwordChecks.number} label="One number" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••••••"
            {...register('confirmPassword')}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function PasswordCheck({ check, label }: { check: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${check ? 'text-green-600' : 'text-muted-foreground'}`}>
      <CheckCircle2 className={`h-3 w-3 ${check ? 'opacity-100' : 'opacity-30'}`} />
      {label}
    </div>
  );
}
