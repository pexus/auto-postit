import { useState, useCallback, useRef } from 'react';
import {
  Folder,
  FileVideo,
  ArrowLeft,
  Upload,
  FolderPlus,
  Search,
  Grid,
  List,
  Check,
  X,
  Copy,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useMediaBrowse,
  useMediaSearch,
  useMediaUpload,
  useMediaCreateFolder,
  useMediaDelete,
  MediaFileInfo,
  FolderInfo,
  MediaSource,
  formatFileSize,
  getLocalPath,
} from '@/hooks/useMedia';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface MediaBrowserProps {
  source?: MediaSource;
  onSelect?: (file: MediaFileInfo) => void;
  selectionMode?: boolean;
  selectedFiles?: MediaFileInfo[];
  onSelectionChange?: (files: MediaFileInfo[]) => void;
  maxSelection?: number;
}

export function MediaBrowser({
  source = 'media',
  onSelect,
  selectionMode = false,
  selectedFiles = [],
  onSelectionChange,
  maxSelection = 10,
}: MediaBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<MediaFileInfo | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: browseData, isLoading, refetch } = useMediaBrowse(currentPath, source);
  const { data: searchData, isLoading: isSearchLoading } = useMediaSearch(
    searchQuery,
    source
  );
  
  const uploadMutation = useMediaUpload();
  const createFolderMutation = useMediaCreateFolder();
  const deleteMutation = useMediaDelete();

  const files = isSearching && searchQuery.length >= 2 
    ? searchData?.results || [] 
    : browseData?.files || [];
  const folders = isSearching ? [] : browseData?.folders || [];

  const handleFolderClick = useCallback((folder: FolderInfo) => {
    setCurrentPath(folder.path);
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  const handleNavigateUp = useCallback(() => {
    if (browseData?.parentPath !== null) {
      setCurrentPath(browseData?.parentPath || '');
    }
  }, [browseData?.parentPath]);

  const handleFileClick = useCallback((file: MediaFileInfo) => {
    if (selectionMode) {
      const isFileSelected = selectedFiles.some(f => f.path === file.path);
      if (isFileSelected) {
        onSelectionChange?.(selectedFiles.filter(f => f.path !== file.path));
      } else if (selectedFiles.length < maxSelection) {
        onSelectionChange?.([...selectedFiles, file]);
      } else {
        toast({ title: `Maximum ${maxSelection} files can be selected`, variant: 'destructive' });
      }
    } else if (onSelect) {
      onSelect(file);
    } else {
      setPreviewFile(file);
    }
  }, [selectionMode, selectedFiles, onSelectionChange, onSelect, maxSelection]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      await uploadMutation.mutateAsync({ file, folder: currentPath || undefined });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentPath, uploadMutation]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    
    const folderPath = currentPath 
      ? `${currentPath}/${newFolderName.trim()}`
      : newFolderName.trim();
    
    await createFolderMutation.mutateAsync(folderPath);
    setShowNewFolderDialog(false);
    setNewFolderName('');
  }, [currentPath, newFolderName, createFolderMutation]);

  const handleCopyLocalPath = useCallback((file: MediaFileInfo) => {
    navigator.clipboard.writeText(getLocalPath(file));
    toast({ title: 'Local path copied to clipboard' });
  }, []);

  const handleDelete = useCallback(async (file: MediaFileInfo) => {
    if (source !== 'uploads') {
      toast({ title: 'Can only delete files from uploads folder', variant: 'destructive' });
      return;
    }
    
    if (confirm(`Delete ${file.name}?`)) {
      await deleteMutation.mutateAsync(file.path);
    }
  }, [source, deleteMutation]);

  const isSelected = useCallback((file: MediaFileInfo) => {
    return selectedFiles.some(f => f.path === file.path);
  }, [selectedFiles]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b">
        {/* Navigation */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNavigateUp}
          disabled={browseData?.parentPath === null}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Current path */}
        <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate">
          /{browseData?.currentPath || ''}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(e.target.value.length >= 2);
            }}
            className="pl-8 w-48"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Refresh */}
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Upload (only for uploads folder) */}
        {source === 'uploads' && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading || isSearchLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {/* Folders */}
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => handleFolderClick(folder)}
                    className="flex flex-col items-center p-4 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <Folder className="h-12 w-12 text-blue-500 mb-2" />
                    <span className="text-sm font-medium truncate w-full text-center">
                      {folder.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {folder.fileCount} files
                    </span>
                  </button>
                ))}

                {/* Files */}
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => handleFileClick(file)}
                    className={cn(
                      'relative flex flex-col items-center p-2 rounded-lg border transition-colors',
                      isSelected(file)
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted'
                    )}
                  >
                    {/* Selection indicator */}
                    {selectionMode && isSelected(file) && (
                      <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Thumbnail */}
                    <div className="w-full aspect-square rounded overflow-hidden bg-muted mb-2">
                      {file.type === 'image' ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileVideo className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <span className="text-xs truncate w-full text-center">
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Folders */}
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => handleFolderClick(folder)}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Folder className="h-5 w-5 text-blue-500" />
                    <span className="flex-1 text-left font-medium">
                      {folder.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {folder.fileCount} files, {folder.subfolderCount} folders
                    </span>
                  </button>
                ))}

                {/* Files */}
                {files.map((file) => (
                  <div
                    key={file.path}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg transition-colors',
                      isSelected(file)
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <button
                      onClick={() => handleFileClick(file)}
                      className="flex items-center gap-3 flex-1"
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                        {file.type === 'image' ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileVideo className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 text-left">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {file.type}
                        </div>
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLocalPath(file)}
                        title="Copy local path"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {source === 'uploads' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(file)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {folders.length === 0 && files.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                {isSearching ? (
                  <>
                    <Search className="h-12 w-12 mb-4" />
                    <p>No files found matching "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <Folder className="h-12 w-12 mb-4" />
                    <p>This folder is empty</p>
                    {source === 'uploads' && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload files
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* New folder dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            {previewFile?.type === 'image' ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-h-96 object-contain rounded"
              />
            ) : previewFile?.type === 'video' ? (
              <video
                src={previewFile.url}
                controls
                className="max-h-96 rounded"
              />
            ) : null}
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Size: {previewFile && formatFileSize(previewFile.size)}</p>
              <p>Type: {previewFile?.mimeType}</p>
              <p>Path: {previewFile?.path}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => previewFile && handleCopyLocalPath(previewFile)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Local Path
            </Button>
            {onSelect && previewFile && (
              <Button onClick={() => {
                onSelect(previewFile);
                setPreviewFile(null);
              }}>
                Select
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
