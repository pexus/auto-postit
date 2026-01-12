import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const platforms = [
  { id: 'twitter', name: 'X (Twitter)', description: 'Connect your X account', connected: false },
  { id: 'linkedin', name: 'LinkedIn', description: 'Connect your LinkedIn profile', connected: false },
  { id: 'facebook', name: 'Facebook', description: 'Connect your Facebook Page', connected: false },
  { id: 'instagram', name: 'Instagram', description: 'Connect your Instagram Business account', connected: false },
  { id: 'youtube', name: 'YouTube', description: 'Connect your YouTube channel', connected: false },
  { id: 'pinterest', name: 'Pinterest', description: 'Connect your Pinterest account', connected: false },
];

export function PlatformsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platforms</h1>
        <p className="text-muted-foreground">Connect and manage your social media accounts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => (
          <Card key={platform.id}>
            <CardHeader>
              <CardTitle className="text-lg">{platform.name}</CardTitle>
              <CardDescription>{platform.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* TODO: Implement platform connection */}
              <div className="text-sm text-muted-foreground">
                Not connected
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
