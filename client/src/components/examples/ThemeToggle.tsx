import { ThemeToggle } from '../ThemeToggle';

export default function ThemeToggleExample() {
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex items-center gap-4">
        <p className="text-foreground">Theme Toggle:</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
