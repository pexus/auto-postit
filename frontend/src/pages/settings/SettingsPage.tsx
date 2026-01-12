import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your account information</CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Implement profile settings */}
            <div className="text-muted-foreground">
              Profile settings coming soon...
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and two-factor authentication</CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Implement security settings */}
            <div className="text-muted-foreground">
              Security settings coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
