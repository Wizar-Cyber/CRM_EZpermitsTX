import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/hooks/useAuth";
import { apiPost } from "@/lib/api";

type LoginResponse = {
  token?: string;
  message?: string;
  error?: string;
  msg?: string;
};

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setInvalid(false);

    try {
      const data = await apiPost<LoginResponse>("/auth/login", { email, password });

      if (data?.token) {
        toast.success("Login successful! Welcome back.");
        login(data.token);
        return;
      }

      const errorMessage =
        data?.message || data?.error || data?.msg || "Invalid email or password.";
      toast.error(errorMessage);
      setInvalid(true);
    } catch (err: any) {
      console.error("❌ Login error:", err);
      toast.error(err?.message || "Unexpected error during login.");
      setInvalid(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="hidden bg-card lg:flex items-center justify-center p-10">
        <img
          src="/EZPermitsLOgo.png"
          alt="EZpermitsTX"
          className="max-h-[78vh] w-auto object-contain"
        />
      </div>
      <div className="flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <Card className="w-full max-w-sm p-8 shadow-2xl">
          <CardHeader className="text-center p-0 mb-6">
            <img 
              src="/logo.png" 
              alt="Logo de tu empresa" 
              className="h-20 w-20 mx-auto rounded-xl bg-card p-2 shadow-lg ring-1 ring-border" 
            />
            <CardTitle className="text-3xl font-bold mt-4">Welcome Back!</CardTitle>
            <CardDescription className="mt-2 text-balance">
              Enter your credentials to access your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-0 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setInvalid(false);
                    }}
                    required
                    className={`pl-10 ${invalid ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="text-sm underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setLocation("/reset-password");
                    }}
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setInvalid(false);
                    }}
                    required
                    className={`pl-10 pr-10 ${invalid ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col p-0 pt-6 gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" /> Sign In
                  </>
                )}
              </Button>
              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <a
                  href="/register"
                  className="underline"
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation("/register");
                  }}
                >
                  Sign up
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
