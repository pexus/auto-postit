import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, ExternalLink, Trash2 } from 'lucide-react';
import { usePlatforms, useDeletePlatform, usePlatformConfig, useTwitterAuthUrl, PLATFORM_CONFIG, PlatformType } from '@/hooks/usePlatforms';
import { toast } from '@/hooks/use-toast';

const platformList: { type: PlatformType; name: string; description: string }[] = [
  { type: 'TWITTER', name: 'X (Twitter)', description: 'Connect your X account to post tweets' },
  { type: 'LINKEDIN', name: 'LinkedIn', description: 'Connect your LinkedIn profile' },
  { type: 'FACEBOOK', name: 'Facebook', description: 'Connect your Facebook Page' },
  { type: 'INSTAGRAM', name: 'Instagram', description: 'Connect your Instagram Business account' },
  { type: 'YOUTUBE', name: 'YouTube', description: 'Connect your YouTube channel' },
  { type: 'PINTEREST', name: 'Pinterest', description: 'Connect your Pinterest account' },
];

export function PlatformsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: platforms = [], isLoading: platformsLoading, refetch } = usePlatforms();
  const { data: config } = usePlatformConfig();
  const deletePlatform = useDeletePlatform();
  const twitterAuthUrl = useTwitterAuthUrl();

  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      toast({ title: `${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully!` });
      setSearchParams({});
      refetch();
    } else if (error) {
      toast({ title: 'Connection failed', description: error, variant: 'destructive' });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetch]);

  const handleConnect = async (type: PlatformType) => {
    try {
      if (type === 'TWITTER') {
        const result = await twitterAuthUrl.mutateAsync();
        // Redirect to Twitter auth
        window.location.href = result.authUrl;
      } else {
        toast({ title: 'Coming soon', description: `${type} connection is not yet implemented`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ 
        title: 'Connection failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
  };

  const handleDisconnect = async (platformId: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}?`)) {
      return;
    }
    
    try {
      await deletePlatform.mutateAsync(platformId);
      toast({ title: `${name} disconnected` });
    } catch (error) {
      toast({ 
        title: 'Failed to disconnect', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
  };

  const getConnectedPlatform = (type: PlatformType) => {
    return platforms.find(p => p.type === type && p.isActive);
  };

  const isPlatformConfigured = (type: PlatformType): boolean => {
    if (!config) return false;
    const configKey = type.toLowerCase() as keyof typeof config;
    return config[configKey] ?? false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platforms</h1>
        <p className="text-muted-foreground">Connect and manage your social media accounts</p>
      </div>

      {platformsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {platformList.map((platformInfo) => {
            const connected = getConnectedPlatform(platformInfo.type);
            const isConfigured = isPlatformConfigured(platformInfo.type);
            const platformConfig = PLATFORM_CONFIG[platformInfo.type];

            return (
              <Card key={platformInfo.type} className={connected ? 'border-green-500/50' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {platformConfig?.icon && (
                        <span className="text-xl">{platformConfig.icon}</span>
                      )}
                      {platformInfo.name}
                    </CardTitle>
                    {connected ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{platformInfo.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {connected ? (
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Account: </span>
                        <span className="font-medium">{connected.platformUsername || connected.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(connected.id, platformInfo.name)}
                          disabled={deletePlatform.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ) : isConfigured ? (
                    <Button
                      onClick={() => handleConnect(platformInfo.type)}
                      disabled={twitterAuthUrl.isPending}
                      className="w-full"
                    >
                      {twitterAuthUrl.isPending && platformInfo.type === 'TWITTER' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Connect {platformInfo.name}
                    </Button>
                  ) : (
                    <Alert>
                      <AlertDescription className="text-xs">
                        {platformInfo.type === 'TWITTER' 
                          ? 'Add TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET to your environment to enable.'
                          : 'This platform is not yet configured.'}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
