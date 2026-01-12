import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Auto-PostIt</h1>
          <p className="text-muted-foreground mt-2">Social Media Scheduler</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
