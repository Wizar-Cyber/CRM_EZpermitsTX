import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";

type ForgotPasswordResponse = {
  message?: string;
  resetUrl?: string;
};

type ResetPasswordResponse = {
  message?: string;
  success?: boolean;
};

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const token = searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generatedResetUrl, setGeneratedResetUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const isTokenMode = Boolean(token);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setGeneratedResetUrl("");

    try {
      const data = await apiPost<ForgotPasswordResponse>("/auth/forgot-password", { email });
      toast.success(data?.message || "If that email exists, password reset instructions were generated.");
      if (data?.resetUrl) {
        setGeneratedResetUrl(data.resetUrl);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not process password recovery.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      toast.error("Password must have 8+ chars, uppercase, lowercase, number and symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiPost<ResetPasswordResponse>("/auth/reset-password", {
        token,
        newPassword,
      });

      toast.success(data?.message || "Password updated successfully. Please sign in.");
      setTimeout(() => setLocation("/login"), 300);
    } catch (err: any) {
      toast.error(err?.message || "Invalid or expired reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  const openGeneratedLink = () => {
    if (!generatedResetUrl) return;
    try {
      const url = new URL(generatedResetUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        setLocation(`${url.pathname}${url.search}`);
      } else {
        window.open(generatedResetUrl, "_self");
      }
    } catch {
      if (generatedResetUrl.startsWith("/")) {
        setLocation(generatedResetUrl);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isTokenMode ? <KeyRound className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
            {isTokenMode ? "Set new password" : "Recover password"}
          </CardTitle>
          <CardDescription>
            {isTokenMode
              ? "Enter your new password to recover access."
              : "Enter your email and we will generate a reset link."}
          </CardDescription>
        </CardHeader>

        {!isTokenMode ? (
          <form onSubmit={handleRequestReset}>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {generatedResetUrl ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="mb-2 text-muted-foreground">Reset link generated.</p>
                  <Button type="button" variant="outline" className="w-full" onClick={openGeneratedLink}>
                    Open reset link
                  </Button>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate reset link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation("/login")}> 
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    className="pl-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation("/login")}> 
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
