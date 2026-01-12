export function MfaPage() {
  return (
    <div className="bg-background rounded-lg border p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Enter the code from your authenticator app
      </p>
      
      {/* TODO: Implement MFA verification form */}
      <div className="space-y-4">
        <div className="text-center text-muted-foreground">
          MFA verification form coming soon...
        </div>
      </div>
    </div>
  );
}
