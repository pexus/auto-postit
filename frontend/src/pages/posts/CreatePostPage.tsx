import { PostEditor } from '@/components/posts/PostEditor';

export function CreatePostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Post</h1>
        <p className="text-muted-foreground">Compose and schedule a new post</p>
      </div>

      <PostEditor mode="create" />
    </div>
  );
}
