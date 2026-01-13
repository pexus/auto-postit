import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, CheckCircle2, Shield, Copy } from 'lucide-react';

export function SettingsPage() {
  const { user, checkSession } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6">
        <ProfileSection user={user} />
        <SecuritySection user={user} onUpdate={checkSession} />
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: { email: string; name: string | null } | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={user?.name ?? ''} disabled />
        </div>
        <p className="text-sm text-muted-foreground">
          Profile editing coming soon...
        </p>
      </CardContent>
    </Card>
  );
}

function SecuritySection({ 
  user, 
  onUpdate 
}: { 
  user: { mfaEnabled: boolean } | null;
  onUpdate: () => Promise<void>;
}) {
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaData, setMfaData] = useState<{
    qrCodeDataUrl: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startMfaSetup = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post<{
        qrCodeDataUrl: string;
        secret: string;
        backupCodes: string[];
      }>('/auth/mfa/setup');
      setMfaData(response.data);
      setShowMfaSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start MFA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const enableMfa = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await api.post('/auth/mfa/enable', { code: verifyCode });
      setSuccess('MFA enabled successfully!');
      setShowMfaSetup(false);
      setMfaData(null);
      setVerifyCode('');
      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const disableMfa = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await api.post('/auth/mfa/disable', { password: disablePassword });
      setSuccess('MFA disabled successfully');
      setDisablePassword('');
      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security
        </CardTitle>
        <CardDescription>Manage your password and two-factor authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="border-green-500 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* MFA Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Two-Factor Authentication</h4>
              <p className="text-sm text-muted-foreground">
                {user?.mfaEnabled 
                  ? 'MFA is enabled on your account' 
                  : 'Add an extra layer of security'}
              </p>
            </div>
            {!showMfaSetup && !user?.mfaEnabled && (
              <Button onClick={startMfaSetup} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enable MFA
              </Button>
            )}
          </div>

          {/* MFA Setup Flow */}
          {showMfaSetup && mfaData && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <img 
                  src={mfaData.qrCodeDataUrl} 
                  alt="QR Code" 
                  className="mx-auto border rounded"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Manual entry code</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                    {mfaData.secret}
                  </code>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(mfaData.secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Backup codes (save these!)</Label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-muted rounded">
                  {mfaData.backupCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono">{code}</code>
                  ))}
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => copyToClipboard(mfaData.backupCodes.join('\n'))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy all backup codes
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter code from authenticator</Label>
                <Input
                  id="verifyCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-xl tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowMfaSetup(false);
                    setMfaData(null);
                    setVerifyCode('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={enableMfa}
                  disabled={isLoading || verifyCode.length < 6}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Enable
                </Button>
              </div>
            </div>
          )}

          {/* Disable MFA */}
          {user?.mfaEnabled && (
            <div className="space-y-2 p-4 border rounded-lg">
              <Label htmlFor="disablePassword">Enter password to disable MFA</Label>
              <Input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Your password"
              />
              <Button 
                variant="destructive" 
                onClick={disableMfa}
                disabled={isLoading || !disablePassword}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disable MFA
              </Button>
            </div>
          )}
        </div>

        {/* Password Change Section */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">Change Password</h4>
          <p className="text-sm text-muted-foreground">
            Password change coming soon...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
