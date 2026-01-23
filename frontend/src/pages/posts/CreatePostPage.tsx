import { useLocation } from 'react-router-dom';
import { PostEditor } from '@/components/posts/PostEditor';

export function CreatePostPage() {
  const location = useLocation();
  const isRepost = !!(location.state as { repostFrom?: unknown })?.repostFrom;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isRepost ? 'Repost' : 'Create Post'}</h1>
        <p className="text-muted-foreground">
          {isRepost 
            ? 'Edit and publish this post again' 
            : 'Compose and schedule a new post'}
        </p>
      </div>

      <PostEditor mode="create" />
    </div>
  );
}
