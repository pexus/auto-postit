import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PostsPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
          <CardDescription>View and manage your scheduled and published posts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            No posts yet. Create your first post to get started!
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
