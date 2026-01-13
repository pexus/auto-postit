import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, Shield } from 'lucide-react';

const mfaSchema = z.object({
  code: z
    .string()
    .min(6, 'Code must be at least 6 characters')
    .max(20, 'Code must be at most 20 characters'),
});

type MfaFormData = z.infer<typeof mfaSchema>;

export function MfaPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
  });

  const onSubmit = async (data: MfaFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/mfa/verify', { code: data.code });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background rounded-lg border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Enter the 6-digit code from your authenticator app, or use a backup code
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input
            id="code"
            type="text"
            placeholder="000000"
            autoComplete="one-time-code"
            className="text-center text-2xl tracking-widest"
            maxLength={20}
            {...register('code')}
            disabled={isLoading}
          />
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Lost access to your authenticator? Use one of your backup codes.
      </p>
    </div>
  );
}
