import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function CreatePostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Post</h1>
        <p className="text-muted-foreground">Compose and schedule a new post</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Post</CardTitle>
          <CardDescription>Write your content and select platforms to publish to</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement post creation form */}
          <div className="text-center py-12 text-muted-foreground">
            Post creation form coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
