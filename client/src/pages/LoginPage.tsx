import { useState, createContext, useContext, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Mail, Lock, LogIn, Sparkles, Eye, EyeOff } from "lucide-react";

// --- Contexto de Autenticación (sin cambios) ---
const AuthContext = createContext<{ login: (token: string) => void } | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const login = (token: string) => {
    localStorage.setItem("authToken", token);
    console.log("Token stored:", token);
  };
  return <AuthContext.Provider value={{ login }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// --- Componente de bienvenida con Gemini (sin cambios) ---
function GeminiWelcome() {
    const [quote, setQuote] = useState("The key to unlocking your business potential.");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInspirationalQuote = async () => {
            setIsLoading(true);
            try {
                const apiKey = ""; 
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
                const systemPrompt = "You are a business mentor. Provide concise, motivational quotes suitable for a CRM login screen. The tone should be inspiring and professional. Max 20 words.";
                const userQuery = "A powerful quote for a sales professional to start their day.";
                const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error("Failed to fetch quote from Gemini API.");
                const result = await response.json();
                const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (generatedText) setQuote(generatedText.trim().replace(/^"|"$/g, ''));
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
                {isLoading ? <p>Generating a thought for your day...</p> : <p className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-300"/><em>"{quote}"</em></p>}
            </div>
        </div>
    );
}


function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      if (data.token) {
        login(data.token);
        toast.success("Login successful! Redirecting...");
        setLocation("/dashboard");
      } else {
        throw new Error("Token not found in response");
      }
    } catch (err: any) {
      toast.error(err.message || "An unknown error occurred.");
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
        {/* MODIFICADO: Todo el contenido del login ahora está dentro de una única Card con sombra y borde */}
        <Card className="w-full max-w-sm p-8 shadow-2xl">
            <CardHeader className="text-center p-0 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.001 1.993l-10 7.5a1 1 0 00-.5 1.5v10a1 1 0 001 1h5v-6a1 1 0 011-1h3a1 1 0 011 1v6h5a1 1 0 001-1v-10a1 1 0 00-.5-1.5l-10-7.5zm5.5 17h-3v-6a3 3 0 00-3-3h-3a3 3 0 00-3 3v6h-3v-8.812l8-6 8 6v8.812h-3zM8.5 12.5a.5.5 0 01.5-.5h6a.5.5 0 01.5.5v4a.5.5 0 01-.5.5h-6a.5.5 0 01-.5-.5v-4zm1 .5v3h5v-3h-5zm3.646 1.146a.5.5 0 01.708 0l1 1a.5.5 0 01-.708.708l-1-1a.5.5 0 010-.708zm-2.854.354a.5.5 0 00-.708 0l-1 1a.5.5 0 00.708.708l1-1a.5.5 0 000-.708z"/>
                </svg>
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
                            <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <a href="#" className="text-sm underline" onClick={(e) => { e.preventDefault(); toast.info("Forgot Password feature is coming soon!"); }}>
                                Forgot password?
                            </a>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-label="Toggle password visibility">
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col p-0 pt-6 gap-4">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Signing In..." : <> <LogIn className="w-4 h-4 mr-2"/> Sign In </>}
                    </Button>
                     <div className="text-center text-sm">
                        Don&apos;t have an account?{" "}
                        <a href="/register" className="underline" onClick={(e) => { e.preventDefault(); setLocation('/register'); }}>
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
  return (
    <AuthProvider>
      <LoginPageContent />
    </AuthProvider>
  );
}
