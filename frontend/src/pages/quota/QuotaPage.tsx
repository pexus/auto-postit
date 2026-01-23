import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Loader2, TrendingUp, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuota, PlatformQuota } from '@/hooks/useQuota';
import { PLATFORM_CONFIG, PlatformType } from '@/hooks/usePlatforms';
import { cn } from '@/lib/utils';

function QuotaCard({ quota }: { quota: PlatformQuota }) {
  const config = PLATFORM_CONFIG[quota.platformType as PlatformType];
  
  const getDailyColor = () => {
    if (quota.daily.percentage >= 100) return 'bg-red-500';
    if (quota.daily.percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getMonthlyColor = () => {
    if (quota.monthly.percentage >= 100) return 'bg-red-500';
    if (quota.monthly.percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className={cn(
      quota.isAtLimit && 'border-red-500',
      quota.isNearLimit && !quota.isAtLimit && 'border-yellow-500'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded text-white text-lg',
                config?.color || 'bg-gray-500'
              )}
            >
              {config?.icon || '?'}
            </span>
            <div>
              <CardTitle className="text-base">{quota.displayName}</CardTitle>
              <CardDescription className="text-xs">{quota.platformName}</CardDescription>
            </div>
          </div>
          {quota.isAtLimit ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Limit Reached
            </Badge>
          ) : quota.isNearLimit ? (
            <Badge variant="warning" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Near Limit
            </Badge>
          ) : (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              OK
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Daily
            </span>
            <span className="font-medium">
              {quota.daily.used} / {quota.daily.limit}
            </span>
          </div>
          <Progress 
            value={quota.daily.percentage} 
            className="h-2"
            indicatorClassName={getDailyColor()}
          />
          <p className="text-xs text-muted-foreground">
            {quota.daily.remaining} posts remaining today
          </p>
        </div>

        {/* Monthly Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Monthly
            </span>
            <span className="font-medium">
              {quota.monthly.used} / {quota.monthly.limit}
            </span>
          </div>
          <Progress 
            value={quota.monthly.percentage} 
            className="h-2"
            indicatorClassName={getMonthlyColor()}
          />
          <p className="text-xs text-muted-foreground">
            {quota.monthly.remaining} posts remaining this month
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuotaPage() {
  const { data, isLoading, error } = useQuota();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Quota</h1>
        <p className="text-muted-foreground">Monitor your API usage across platforms</p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Overview
          </CardTitle>
          <CardDescription>Track your API consumption to stay within free tier limits</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Failed to load quota data. Please try again.
            </div>
          ) : !data || data.platforms.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-muted-foreground">Connect platforms to view quota usage</p>
              <Button asChild>
                <Link to="/platforms">Connect Platforms</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Connected Platforms</p>
                  <p className="text-2xl font-bold">{data.summary.connectedPlatforms}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Posts Today</p>
                  <p className="text-2xl font-bold">{data.summary.totalDailyPosts}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Posts This Month</p>
                  <p className="text-2xl font-bold">{data.summary.totalMonthlyPosts}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Platforms Near Limit</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    data.summary.platformsNearLimit > 0 && "text-yellow-600",
                    data.summary.platformsAtLimit > 0 && "text-red-600"
                  )}>
                    {data.summary.platformsAtLimit > 0 
                      ? `${data.summary.platformsAtLimit} at limit`
                      : data.summary.platformsNearLimit > 0
                      ? `${data.summary.platformsNearLimit} near`
                      : 'None'}
                  </p>
                </div>
              </div>

              {/* Platform Cards */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Platform Usage</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.platforms.map((quota) => (
                    <QuotaCard key={quota.platformId} quota={quota} />
                  ))}
                </div>
              </div>

              {/* Limits Info */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium mb-2">About Free Tier Limits</h4>
                <p className="text-sm text-muted-foreground">
                  These limits are based on typical free tier API restrictions for each platform.
                  Actual limits may vary based on your account type and platform policies.
                  Limits reset daily at midnight and monthly on the 1st.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
