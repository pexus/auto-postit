import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';

interface ImportError {
  row: number;
  column?: string;
  error: string;
}

interface ImportResult {
  success: boolean;
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    errors: ImportError[];
    warnings: string[];
  };
  posts: Array<{
    id: string;
    platform: string;
    scheduled_date: string;
    status: string;
  }>;
}

export function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.csv', '.xlsx', '.xls'];

    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidType && !hasValidExtension) {
      setError('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('dry_run', String(isDryRun));

      const response = await fetch('/api/import/spreadsheet', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (!response.ok && !data.summary) {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Posts</h1>
        <p className="text-muted-foreground">
          Bulk import posts from a spreadsheet (CSV or Excel)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Spreadsheet
            </CardTitle>
            <CardDescription>
              Upload a CSV or Excel file with your scheduled posts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop your file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Dry Run Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-sm">Preview Mode</p>
                <p className="text-xs text-muted-foreground">
                  Validate without creating posts
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full"
            >
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDryRun ? 'Validate File' : 'Import Posts'}
            </Button>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Template
            </CardTitle>
            <CardDescription>
              Get a template file with sample data and column headers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <a
                href="/api/import/template.csv"
                download
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium">CSV Template</p>
                    <p className="text-sm text-muted-foreground">
                      Comma-separated values
                    </p>
                  </div>
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
              </a>

              <a
                href="/api/import/template.xlsx"
                download
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium">Excel Template</p>
                    <p className="text-sm text-muted-foreground">
                      Microsoft Excel (.xlsx)
                    </p>
                  </div>
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
              </a>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">Required columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>platform</code> - x, linkedin, facebook, instagram, youtube, pinterest</li>
                <li><code>scheduled_date</code> - ISO 8601 format</li>
                <li><code>content</code> - Post text</li>
              </ul>
              <p className="mt-2">
                <a href="/docs/IMPORT_FORMAT.md" className="text-primary hover:underline">
                  View full documentation →
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : result.summary.imported > 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {isDryRun ? 'Validation Results' : 'Import Results'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{result.summary.total_rows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">
                  {result.summary.imported}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isDryRun ? 'Valid' : 'Imported'}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">
                  {result.summary.skipped}
                </p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>

            {/* Warnings */}
            {result.summary.warnings.length > 0 && (
              <Alert className="border-yellow-500">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <p className="font-medium mb-2">Warnings ({result.summary.warnings.length})</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {result.summary.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {result.summary.warnings.length > 5 && (
                      <li className="text-muted-foreground">
                        ...and {result.summary.warnings.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Errors */}
            {result.summary.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Errors ({result.summary.errors.length})</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {result.summary.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Row {err.row}
                        {err.column && ` (${err.column})`}: {err.error}
                      </li>
                    ))}
                    {result.summary.errors.length > 10 && (
                      <li className="text-muted-foreground">
                        ...and {result.summary.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Imported Posts Preview */}
            {result.posts.length > 0 && (
              <div>
                <p className="font-medium mb-2">
                  {isDryRun ? 'Posts to be created:' : 'Created posts:'}
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Platform</th>
                        <th className="px-4 py-2 text-left">Scheduled Date</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.posts.slice(0, 10).map((post) => (
                        <tr key={post.id} className="border-t">
                          <td className="px-4 py-2 capitalize">{post.platform}</td>
                          <td className="px-4 py-2">
                            {new Date(post.scheduled_date).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 capitalize">{post.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.posts.length > 10 && (
                    <div className="px-4 py-2 bg-muted text-sm text-muted-foreground">
                      ...and {result.posts.length - 10} more posts
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            {isDryRun && result.summary.imported > 0 && (
              <Button
                onClick={() => {
                  setIsDryRun(false);
                  handleUpload();
                }}
                className="w-full"
              >
                Import {result.summary.imported} Posts
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
