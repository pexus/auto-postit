import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
  Trash2,
  CalendarOff,
  Image,
  Repeat2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePosts, useDeletePost, useUnschedulePost, Post, PostStatus, getMediaUrl } from '@/hooks/usePosts';
import { PLATFORM_CONFIG, PlatformType } from '@/hooks/usePlatforms';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<PostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { label: 'Draft', variant: 'secondary', icon: Pencil },
  SCHEDULED: { label: 'Scheduled', variant: 'default', icon: Calendar },
  PUBLISHING: { label: 'Publishing', variant: 'warning', icon: Loader2 },
  PUBLISHED: { label: 'Published', variant: 'success', icon: CheckCircle },
  PARTIALLY_PUBLISHED: { label: 'Partial', variant: 'warning', icon: Clock },
  FAILED: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

export function PostsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; post: Post | null }>({
    open: false,
    post: null,
  });

  const { data, isLoading } = usePosts(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  const deletePost = useDeletePost();
  const unschedulePost = useUnschedulePost();

  const posts = data?.posts || [];

  const handleDelete = async () => {
    if (deleteDialog.post) {
      await deletePost.mutateAsync(deleteDialog.post.id);
      setDeleteDialog({ open: false, post: null });
    }
  };

  const handleRepost = (post: Post) => {
    // Navigate to create post with pre-populated content
    navigate('/posts/new', {
      state: {
        repostFrom: {
          content: post.content,
          platformIds: post.platforms.map(p => p.platformId),
          mediaFiles: post.mediaFiles,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Posts</h1>
          <p className="text-muted-foreground">Manage your social media posts</p>
        </div>
        <Button asChild>
          <Link to="/posts/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as PostStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="DRAFT">Drafts</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posts List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === 'all' ? 'All Posts' : STATUS_CONFIG[statusFilter]?.label || 'Posts'}
          </CardTitle>
          <CardDescription>
            {data?.total ? `${data.total} post${data.total !== 1 ? 's' : ''}` : 'View and manage your posts'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {statusFilter === 'all'
                ? 'No posts yet. Create your first post to get started!'
                : `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase() || ''} posts.`}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={() => setDeleteDialog({ open: true, post })}
                  onUnschedule={() => unschedulePost.mutate(post.id)}
                  onRepost={() => handleRepost(post)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, post: open ? deleteDialog.post : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, post: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePost.isPending}
            >
              {deletePost.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PostCardProps {
  post: Post;
  onDelete: () => void;
  onUnschedule: () => void;
  onRepost: () => void;
}

function PostCard({ post, onDelete, onUnschedule, onRepost }: PostCardProps) {
  const statusConfig = STATUS_CONFIG[post.status];
  const StatusIcon = statusConfig.icon;
  const hasMedia = post.mediaFiles && post.mediaFiles.length > 0;

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      {/* Media Thumbnail */}
      {hasMedia && (
        <div className="flex-shrink-0">
          <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
            {post.mediaFiles[0].mediaFile.mimeType.startsWith('image/') ? (
              <img
                src={getMediaUrl(post.mediaFiles[0].mediaFile.storagePath)}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            {post.mediaFiles.length > 1 && (
              <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded-tl">
                +{post.mediaFiles.length - 1}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Preview */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm line-clamp-2">{post.content}</p>

        {/* Platform badges */}
        <div className="flex flex-wrap gap-1">
          {post.platforms.map((pp) => {
            const config = PLATFORM_CONFIG[pp.platform.type as PlatformType];
            return (
              <span
                key={pp.id}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white',
                  config?.color || 'bg-gray-500'
                )}
                title={pp.platform.name}
              >
                {config?.icon || '?'}
              </span>
            );
          })}
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Created {format(new Date(post.createdAt), 'MMM d, yyyy')}</span>
          {post.scheduledAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Scheduled for {format(new Date(post.scheduledAt), 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Published {format(new Date(post.publishedAt), 'MMM d, yyyy h:mm a')}
            </span>
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-2">
        <Badge variant={statusConfig.variant} className="flex items-center gap-1">
          <StatusIcon className={cn('h-3 w-3', post.status === 'PUBLISHING' && 'animate-spin')} />
          {statusConfig.label}
        </Badge>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Repost button - available for all posts */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onRepost}
            title="Repost"
          >
            <Repeat2 className="h-4 w-4" />
          </Button>
          {['DRAFT', 'SCHEDULED'].includes(post.status) && (
            <Button size="icon" variant="ghost" asChild>
              <Link to={`/posts/${post.id}/edit`} title="Edit">
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {post.status === 'SCHEDULED' && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onUnschedule}
              title="Unschedule"
            >
              <CalendarOff className="h-4 w-4" />
            </Button>
          )}
          {['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
