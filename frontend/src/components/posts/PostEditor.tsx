import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  CalendarIcon, 
  ImageIcon, 
  X, 
  AlertCircle, 
  Loader2, 
  FolderOpen, 
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  Undo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MediaBrowser } from '@/components/media/MediaBrowser';
import { usePlatforms, PLATFORM_CONFIG, Platform, PlatformType } from '@/hooks/usePlatforms';
import { useCreatePost, useUpdatePost, Post, CreatePostInput } from '@/hooks/usePosts';
import { useAIConfig, useRefineContent } from '@/hooks/useAI';
import { MediaFileInfo } from '@/hooks/useMedia';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface PostEditorProps {
  post?: Post;
  mode?: 'create' | 'edit';
}

export function PostEditor({ post, mode = 'create' }: PostEditorProps) {
  const navigate = useNavigate();
  const { data: platforms = [], isLoading: platformsLoading } = usePlatforms();
  const { data: aiConfig } = useAIConfig();
  const refineContent = useRefineContent();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  // Form state
  const [content, setContent] = useState(post?.content || '');
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(
    post?.platforms.map(p => p.platformId) || []
  );
  const [scheduledAt, setScheduledAt] = useState<string>(
    post?.scheduledAt ? format(new Date(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [selectedMedia, setSelectedMedia] = useState<MediaFileInfo[]>([]);
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const [mediaSource, setMediaSource] = useState<'media' | 'uploads'>('uploads');

  // AI state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [refinedContent, setRefinedContent] = useState<string | null>(null);
  const [originalBeforeRefine, setOriginalBeforeRefine] = useState<string | null>(null);

  // Get selected platform types for AI
  const selectedPlatformTypes = useMemo((): PlatformType[] => {
    return selectedPlatformIds
      .map(id => platforms.find(p => p.id === id)?.type)
      .filter((t): t is PlatformType => t !== undefined);
  }, [selectedPlatformIds, platforms]);

  // Calculate character counts for each platform
  const characterCounts = useMemo(() => {
    const counts: Record<string, { current: number; max: number; exceeded: boolean }> = {};
    const textToCheck = refinedContent ?? content;
    
    selectedPlatformIds.forEach(platformId => {
      const platform = platforms.find(p => p.id === platformId);
      if (platform) {
        const config = PLATFORM_CONFIG[platform.type];
        const current = textToCheck.length;
        counts[platformId] = {
          current,
          max: config.maxChars,
          exceeded: current > config.maxChars,
        };
      }
    });
    
    return counts;
  }, [content, refinedContent, selectedPlatformIds, platforms]);

  // Check if any platform limit is exceeded
  const hasExceededLimit = Object.values(characterCounts).some(c => c.exceeded);

  // Get minimum character limit among selected platforms
  const minCharLimit = useMemo(() => {
    if (selectedPlatformIds.length === 0) return null;
    
    let min = Infinity;
    selectedPlatformIds.forEach(platformId => {
      const platform = platforms.find(p => p.id === platformId);
      if (platform) {
        const config = PLATFORM_CONFIG[platform.type];
        min = Math.min(min, config.maxChars);
      }
    });
    
    return min === Infinity ? null : min;
  }, [selectedPlatformIds, platforms]);

  const handlePlatformToggle = (platformId: string, checked: boolean) => {
    if (checked) {
      setSelectedPlatformIds(prev => [...prev, platformId]);
    } else {
      setSelectedPlatformIds(prev => prev.filter(id => id !== platformId));
    }
    // Clear AI refined content when platforms change
    setRefinedContent(null);
    setOriginalBeforeRefine(null);
  };

  const handleRemoveMedia = (file: MediaFileInfo) => {
    setSelectedMedia(prev => prev.filter(f => f.path !== file.path));
  };

  // AI refinement handlers
  const handleRefine = async () => {
    if (!content.trim()) {
      toast({ title: 'Please enter some content first', variant: 'destructive' });
      return;
    }

    try {
      const result = await refineContent.mutateAsync({
        content: content.trim(),
        platforms: selectedPlatformTypes.length > 0 ? selectedPlatformTypes as string[] : [],
        additionalContext: aiContext.trim() || undefined,
        model: selectedModel || aiConfig?.defaultModel,
      });

      setOriginalBeforeRefine(content);
      setRefinedContent(result.refinedContent);
      toast({ title: 'Content refined successfully!' });
    } catch (error) {
      toast({ 
        title: 'Failed to refine content', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    }
  };

  const handleAcceptRefinement = () => {
    if (refinedContent) {
      setContent(refinedContent);
      setRefinedContent(null);
      setOriginalBeforeRefine(null);
      setAiContext('');
    }
  };

  const handleRejectRefinement = () => {
    setRefinedContent(null);
    setOriginalBeforeRefine(null);
  };

  const handleRegenerate = () => {
    handleRefine();
  };

  const handleSubmit = async (asDraft = false) => {
    const finalContent = refinedContent ?? content;
    if (!finalContent.trim()) {
      return;
    }

    const input: CreatePostInput = {
      content: finalContent.trim(),
      platformIds: selectedPlatformIds,
    };

    if (!asDraft && scheduledAt) {
      input.scheduledAt = new Date(scheduledAt).toISOString();
    }

    try {
      if (mode === 'edit' && post) {
        await updatePost.mutateAsync({ id: post.id, data: input });
      } else {
        await createPost.mutateAsync(input);
      }
      navigate('/posts');
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isSubmitting = createPost.isPending || updatePost.isPending;
  const isRefining = refineContent.isPending;
  const displayContent = refinedContent ?? content;

  return (
    <div className="space-y-6">
      {/* Content Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show side-by-side comparison when AI has refined */}
          {refinedContent ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Original Draft</Label>
                  <div className="p-3 bg-muted rounded-md min-h-[150px] text-sm whitespace-pre-wrap">
                    {originalBeforeRefine}
                  </div>
                </div>
                
                {/* Refined */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    AI Refined
                  </Label>
                  <Textarea
                    value={refinedContent}
                    onChange={(e) => setRefinedContent(e.target.value)}
                    className="min-h-[150px] resize-y border-primary"
                  />
                </div>
              </div>
              
              {/* Action buttons for refinement */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {refinedContent.length} characters
                  {minCharLimit && (
                    <span className={cn(
                      refinedContent.length > minCharLimit ? 'text-destructive' : ''
                    )}>
                      {' '}/ {minCharLimit}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRejectRefinement}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Discard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isRefining}
                  >
                    {isRefining ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAcceptRefinement}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Normal content editing */
            <div className="space-y-2">
              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] resize-y"
              />
              
              {/* Character count indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {content.length} characters
                  {minCharLimit && (
                    <span className={cn(
                      content.length > minCharLimit ? 'text-destructive' : ''
                    )}>
                      {' '}/ {minCharLimit} (strictest limit)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Per-platform character warnings */}
          {hasExceededLimit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Content exceeds character limit for some platforms:
                <ul className="mt-1 list-disc list-inside">
                  {Object.entries(characterCounts)
                    .filter(([, c]) => c.exceeded)
                    .map(([platformId, c]) => {
                      const platform = platforms.find(p => p.id === platformId);
                      if (!platform) return null;
                      return (
                        <li key={platformId}>
                          {PLATFORM_CONFIG[platform.type].name}: {c.current}/{c.max}
                        </li>
                      );
                    })}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Assistant Section - Collapsible */}
          {aiConfig?.available && !refinedContent && (
            <Collapsible open={aiExpanded} onOpenChange={setAiExpanded}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    AI Assistant
                  </span>
                  {aiExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4 p-4 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="aiContext">Additional context (optional)</Label>
                  <Textarea
                    id="aiContext"
                    placeholder='e.g., "Make it more casual", "Add relevant hashtags", "Focus on the product benefits"'
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    className="min-h-[80px] resize-y"
                  />
                </div>
                
                <div className="flex items-end gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aiModel">Model</Label>
                    <Select 
                      value={selectedModel || aiConfig.defaultModel} 
                      onValueChange={setSelectedModel}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aiConfig.availableModels.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={handleRefine}
                    disabled={isRefining || !content.trim()}
                  >
                    {isRefining ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Refine with AI
                  </Button>
                </div>

                {selectedPlatformTypes.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    AI will optimize for: {selectedPlatformTypes.map(t => PLATFORM_CONFIG[t]?.name || t).join(', ')}
                    {selectedPlatformTypes.length > 1 && ' (unified engaging tone)'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No platform selected - will use Twitter-style concise format (280 chars max)
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Media attachment */}
          <div className="space-y-2">
            <Label>Media Attachments</Label>
            <div className="flex flex-wrap gap-2">
              {selectedMedia.map((file) => (
                <div
                  key={file.path}
                  className="relative group w-24 h-24 rounded-md overflow-hidden border"
                >
                  {file.type === 'image' ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Video</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveMedia(file)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowMediaBrowser(true)}
                className="w-24 h-24 rounded-md border border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted transition-colors"
              >
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">Add Media</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          {platformsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : platforms.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No platforms connected. Go to{' '}
                <a href="/platforms" className="underline">
                  Platforms
                </a>{' '}
                to connect your social media accounts.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  selected={selectedPlatformIds.includes(platform.id)}
                  characterCount={characterCounts[platform.id]}
                  onToggle={(checked) => handlePlatformToggle(platform.id, checked)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Schedule for later (optional)</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="max-w-xs"
            />
            {scheduledAt && (
              <p className="text-sm text-muted-foreground">
                Will be published: {format(new Date(scheduledAt), 'PPpp')}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate('/posts')}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !displayContent.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={
                isSubmitting ||
                !displayContent.trim() ||
                hasExceededLimit ||
                (!!scheduledAt && selectedPlatformIds.length === 0)
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {scheduledAt ? 'Schedule Post' : 'Save Post'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Media Browser Dialog */}
      <Dialog open={showMediaBrowser} onOpenChange={setShowMediaBrowser}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Media</DialogTitle>
          </DialogHeader>
          <Tabs value={mediaSource} onValueChange={(v) => setMediaSource(v as 'media' | 'uploads')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="uploads" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Uploads
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Media Folder
              </TabsTrigger>
            </TabsList>
            <TabsContent value="uploads" className="flex-1 overflow-auto mt-4">
              <MediaBrowser
                source="uploads"
                selectionMode
                selectedFiles={selectedMedia}
                onSelectionChange={setSelectedMedia}
                maxSelection={10}
              />
            </TabsContent>
            <TabsContent value="media" className="flex-1 overflow-auto mt-4">
              <MediaBrowser
                source="media"
                selectionMode
                selectedFiles={selectedMedia}
                onSelectionChange={setSelectedMedia}
                maxSelection={10}
              />
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowMediaBrowser(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowMediaBrowser(false)}>
              Done ({selectedMedia.length} selected)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Platform selection card component
interface PlatformCardProps {
  platform: Platform;
  selected: boolean;
  characterCount?: { current: number; max: number; exceeded: boolean };
  onToggle: (checked: boolean) => void;
}

function PlatformCard({ platform, selected, characterCount, onToggle }: PlatformCardProps) {
  const config = PLATFORM_CONFIG[platform.type];

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 cursor-pointer transition-all',
        selected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
      )}
      onClick={() => onToggle(!selected)}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
              config.color
            )}>
              {config.icon}
            </span>
            <span className="font-medium truncate">{platform.name}</span>
          </div>
          {platform.platformUsername && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              @{platform.platformUsername}
            </p>
          )}
          {selected && characterCount && (
            <div className="mt-2">
              <Badge
                variant={characterCount.exceeded ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {characterCount.current}/{characterCount.max}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
