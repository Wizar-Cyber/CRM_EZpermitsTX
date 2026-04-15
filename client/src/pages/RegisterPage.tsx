// src/pages/RegisterPage.tsx
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mail, Lock, Phone, UserPlus, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiPost } from "@/lib/api";

function PasswordStrengthIndicator({ criteria }: { criteria: Record<string, boolean> }) {
  const map = {
    length: "8 chars",
    uppercase: "Uppercase",
    lowercase: "Lowercase",
    number: "Number",
    special: "Special",
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
      {Object.entries(map).map(([k, txt]) => (
        <div key={k} className={`flex items-center text-xs ${criteria[k] ? "text-emerald-500" : "text-muted-foreground"}`}>
          {criteria[k] ? <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> : <XCircle className="w-2.5 h-2.5 mr-1" />}{txt}
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const pwCrit = useMemo(() => ({
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
  }), [form.password]);

  const pwValid = Object.values(pwCrit).every(Boolean);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) return toast.error("Password does not meet all requirements.");
    if (form.password !== form.confirmPassword) return toast.error("Passwords do not match.");
    if (!agreed) return toast.error("Please accept terms and privacy policy.");

    setLoading(true);
    try {
      const fullname = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
      const payload = {
        fullname,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        // el backend ignora role/role_id y asigna 'user' vía FK
      };

      // Usa el helper (API_BASE_URL usa import.meta.env.VITE_API_URL)
      const res = await apiPost<{ message: string; user: any }>("/auth/register", payload);

      toast.success(res?.message || "Registration successful! Wait for admin approval.");
      setTimeout(() => setLocation("/login"), 0);
    } catch (err: any) {
      toast.error(err?.message || "Registration error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="hidden bg-black lg:flex items-center justify-center p-0">
        <img
          src="/EZPermitsLOgo.png"
          alt="EZpermitsTX"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="w-full flex flex-col items-center justify-start lg:justify-center lg:min-h-[100vh] overflow-y-auto py-4 px-3 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <Card className="w-full max-w-md p-4 sm:p-6 shadow-2xl">
          <CardHeader className="text-center p-0 mb-4">
            <img
              src="/logo.png"
              alt="Logo de tu empresa"
              className="h-16 w-16 mx-auto rounded-lg shadow-lg object-contain"
            />
            <CardTitle className="text-2xl font-bold mt-2">Create Account</CardTitle>
            <CardDescription className="text-xs">Enter your information to register.</CardDescription>
          </CardHeader>

          <form onSubmit={onSubmit} noValidate>
            <CardContent className="p-0 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="firstName" className="text-xs">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={onChange}
                  required
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={onChange}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={onChange}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  required
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {pwFocused && form.password.length > 0 && (
              <PasswordStrengthIndicator criteria={pwCrit} />
            )}

            <div className="grid gap-1">
              <Label htmlFor="confirmPassword" className="text-xs">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPw2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={onChange}
                  required
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2(!showPw2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-2">
              <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
              <label htmlFor="terms" className="text-xs">
                Accept terms and privacy policy
              </label>
            </div>
            </CardContent>

            <CardFooter className="flex-col p-0 pt-4 gap-3">
              <Button type="submit" className="w-full text-sm" disabled={loading || !agreed || !pwValid}>
                {loading ? "Creating..." : (<><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Register</>)}
              </Button>
              <div className="text-center text-xs">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="underline"
                  onClick={(e) => { e.preventDefault(); setTimeout(() => setLocation("/login"), 0); }}
                >
                  Sign in
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
