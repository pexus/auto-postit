import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaBrowser } from '@/components/media/MediaBrowser';
import { FolderOpen, Upload } from 'lucide-react';

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState<'media' | 'uploads'>('media');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Media Library</h1>
        <p className="text-muted-foreground mt-2">
          Browse and manage your media files for social media posts.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'media' | 'uploads')}>
        <TabsList>
          <TabsTrigger value="media" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Media Folder
          </TabsTrigger>
          <TabsTrigger value="uploads" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Uploads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="mt-4">
          <div className="border rounded-lg h-[600px]">
            <MediaBrowser source="media" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            📁 <strong>Media Folder:</strong> Pre-uploaded files that can be mounted from outside the container. 
            Use <code className="bg-muted px-1 rounded">local:path/to/file.jpg</code> in spreadsheet imports to reference these files.
          </p>
        </TabsContent>

        <TabsContent value="uploads" className="mt-4">
          <div className="border rounded-lg h-[600px]">
            <MediaBrowser source="uploads" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            📤 <strong>Uploads:</strong> Files uploaded through the web interface. 
            You can upload, organize, and delete files here.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
