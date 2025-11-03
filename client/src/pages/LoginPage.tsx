import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/hooks/useAuth";

function GeminiWelcome() {
  const [quote, setQuote] = useState("The key to unlocking your business potential.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInspirationalQuote = async () => {
      setIsLoading(true);
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const systemPrompt =
          "You are a business mentor. Provide concise, motivational quotes suitable for a CRM login screen. The tone should be inspiring and professional. Max 20 words.";
        const userQuery = "A powerful quote for a sales professional to start their day.";
        const payload = {
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        };
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to fetch quote from Gemini API.");
        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText) setQuote(generatedText.trim().replace(/^"|"$/g, ""));
      } catch (error) {
        console.error("Gemini API error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInspirationalQuote();
  }, []);

  return (
    <div className="text-center">
      <h1 className="text-5xl font-bold text-white tracking-tighter">Welcome to Your CRM</h1>
      <div className="text-xl text-slate-300 mt-4 min-h-[56px] flex items-center justify-center">
        {isLoading ? (
          <p>Generating a thought for your day...</p>
        ) : (
          <p className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <em>"{quote}"</em>
          </p>
        )}
      </div>
    </div>
  );
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [invalid, setInvalid] = useState(false); // ✅ nuevo estado para resaltar errores
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setInvalid(false);

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      console.log("🔍 Server response:", data);

      if (!res.ok) {
        const errorMessage =
          data?.message || data?.error || data?.msg || "Invalid email or password.";
        toast.error(errorMessage);
        setInvalid(true); // ✅ activa el borde rojo
        return;
      }

      if (data.token) {
        login(data.token);
        toast.success("Login successful! Welcome back.");
      } else {
        toast.error("No token found in response.");
      }
    } catch (err: any) {
      console.error("❌ Login error:", err);
      toast.error(err.message || "Unexpected error during login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="hidden bg-muted lg:flex items-center justify-center p-10 bg-gradient-to-br from-slate-900 to-slate-800">
        <GeminiWelcome />
      </div>
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-sm p-8 shadow-2xl">
          <CardHeader className="text-center p-0 mb-6">
           {/* NUEVA LÍNEA PARA TU LOGO */}
              <img src="/src/public/logo.png"  alt="Logo de tu empresa" className="h-16 w-16 mx-auto" />
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
                      toast.info("Forgot Password feature is coming soon!");
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
