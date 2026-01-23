import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Share2, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface RecentPost {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  platforms: Array<{
    type: string;
    name: string;
    status: string;
  }>;
}

interface DashboardStats {
  totalPosts: number;
  connectedPlatforms: number;
  scheduledPosts: number;
  quotaWarnings: number;
  recentPosts: RecentPost[];
}

function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get<DashboardStats>('/api/dashboard/stats');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  PUBLISHING: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PARTIALLY_PUBLISHED: 'bg-orange-100 text-orange-800',
};

export function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your social media activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalPosts ?? 0}</div>
                <p className="text-xs text-muted-foreground">Across all platforms</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Platforms</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.connectedPlatforms ?? 0}</div>
                <p className="text-xs text-muted-foreground">Of 6 available</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.scheduledPosts ?? 0}</div>
                <p className="text-xs text-muted-foreground">Posts pending</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.quotaWarnings ?? 0}</div>
                <p className="text-xs text-muted-foreground">Platforms near limit</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest posts and actions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentPosts && stats.recentPosts.length > 0 ? (
            <div className="space-y-4">
              {stats.recentPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/posts/${post.id}`}
                  className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {post.platforms.map((platform, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {platform.type}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {post.publishedAt 
                            ? `Published ${format(new Date(post.publishedAt), 'MMM d, yyyy h:mm a')}`
                            : `Created ${format(new Date(post.createdAt), 'MMM d, yyyy h:mm a')}`
                          }
                        </span>
                      </div>
                    </div>
                    <Badge className={statusColors[post.status] || 'bg-gray-100 text-gray-800'}>
                      {post.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </Link>
              ))}
              <div className="pt-2 text-center">
                <Link 
                  to="/posts" 
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  View all posts <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity. Create your first post to get started!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
