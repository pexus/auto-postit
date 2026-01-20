import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { usePost } from '@/hooks/usePosts';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading, error } = usePost(id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Post</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Post not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Can only edit DRAFT or SCHEDULED posts
  if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Post</h1>
        </div>
        <Alert>
          <AlertDescription>
            This post cannot be edited because it has already been {post.status.toLowerCase()}.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Post</h1>
        <p className="text-muted-foreground">Modify your post content and settings</p>
      </div>

      <PostEditor post={post} mode="edit" />
    </div>
  );
}
