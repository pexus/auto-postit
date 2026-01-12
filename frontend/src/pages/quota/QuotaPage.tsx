import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function QuotaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Quota</h1>
        <p className="text-muted-foreground">Monitor your API usage across platforms</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>Track your API consumption to stay within free tier limits</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement quota display */}
          <div className="text-center py-12 text-muted-foreground">
            Connect platforms to view quota usage
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
