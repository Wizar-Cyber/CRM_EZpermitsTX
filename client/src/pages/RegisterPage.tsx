import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { User, Mail, Lock, Phone, Sparkles, UserPlus, FileText, Briefcase, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

// --- Componente de bienvenida con Gemini (sin cambios) ---
function GeminiWelcomeRegister() {
    const [message, setMessage] = useState("Start managing your leads with unparalleled efficiency.");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchWelcomeMessage = async () => {
            setIsLoading(true);
            try {
                const apiKey = ""; // Dejar vacío
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
                const systemPrompt = "You are a welcoming assistant. Provide short, encouraging messages for new users signing up to a CRM. Tone: positive, professional. Max 20 words.";
                const userQuery = "A welcome message for a new user joining a CRM platform.";
                const payload = {
                    contents: [{ parts: [{ text: userQuery }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error("Failed to fetch welcome message.");
                const result = await response.json();
                const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (generatedText) {
                    setMessage(generatedText.trim().replace(/^"|"$/g, ''));
                }
            } catch (error) {
                console.error("Gemini API error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchWelcomeMessage();
    }, []);

    return (
        <div className="text-center">
            <h1 className="text-5xl font-bold text-white tracking-tighter">Join the Future of CRM</h1>
            <div className="text-xl text-slate-300 mt-4 min-h-[56px] flex items-center justify-center">
                 {isLoading ? <p>Preparing a welcome for you...</p> : <p className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-300"/><em>"{message}"</em></p>}
            </div>
        </div>
    );
}

// --- Componente para validar la fortaleza de la contraseña (sin cambios) ---
function PasswordStrengthIndicator({ criteria }: { criteria: Record<string, boolean> }) {
    const criteriaMap = {
        length: "At least 8 characters",
        uppercase: "At least one uppercase letter",
        lowercase: "At least one lowercase letter",
        number: "At least one number",
        special: "At least one special character",
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {Object.entries(criteriaMap).map(([key, text]) => (
                <div key={key} className={`flex items-center text-xs transition-colors ${criteria[key] ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {criteria[key] ? <CheckCircle2 className="w-3 h-3 mr-2"/> : <XCircle className="w-3 h-3 mr-2"/>}
                    {text}
                </div>
            ))}
        </div>
    );
}


export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    secondLastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
    documentType: "",
    documentNumber: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [, setLocation] = useLocation();

  const passwordCriteria = useMemo(() => ({
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(formData.password),
  }), [formData.password]);

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({...prev, [name]: value}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
        toast.error("Password does not meet all security requirements.");
        return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!agreedToTerms) {
      toast.error("You must accept the terms and conditions.");
      return;
    }
    setIsLoading(true);

    try {
      const { confirmPassword, firstName, middleName, lastName, secondLastName, ...restOfData } = formData;
      const fullname = [firstName, middleName, lastName, secondLastName].filter(Boolean).join(" ");
      const payload = { ...restOfData, fullname };

      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      toast.success("Registration successful! Please log in.");
      setLocation("/login");

    } catch (err: any) {
      toast.error(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-lg p-8 shadow-2xl">
            <CardHeader className="text-center p-0 mb-6">
                <img src="/src/public/logo.png"  alt="Logo de tu empresa" className="h-16 w-16 mx-auto" />
                <CardTitle className="text-3xl font-bold mt-4">Create an Account</CardTitle>
                <CardDescription className="mt-2 text-balance">Enter your information to create a new account.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="p-0 grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label htmlFor="firstName">First Name</Label><Input id="firstName" name="firstName" placeholder="John" value={formData.firstName} onChange={handleChange} required /></div>
                        <div className="grid gap-2"><Label htmlFor="middleName">Middle Name</Label><Input id="middleName" name="middleName" placeholder="(Optional)" value={formData.middleName} onChange={handleChange} /></div>
                        <div className="grid gap-2"><Label htmlFor="lastName">Last Name</Label><Input id="lastName" name="lastName" placeholder="Doe" value={formData.lastName} onChange={handleChange} required /></div>
                        <div className="grid gap-2"><Label htmlFor="secondLastName">Second Last Name</Label><Input id="secondLastName" name="secondLastName" placeholder="(Optional)" value={formData.secondLastName} onChange={handleChange} /></div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="email" name="email" type="email" placeholder="m@example.com" value={formData.email} onChange={handleChange} required className="pl-10"/></div></div>
                    <div className="grid gap-2"><Label htmlFor="phone">Phone</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="phone" name="phone" type="tel" placeholder="123-456-7890" value={formData.phone} onChange={handleChange} required className="pl-10"/></div></div>
                    <div className="grid gap-2"><Label htmlFor="role">Role</Label><div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="role" name="role" placeholder="e.g., Sales Manager" value={formData.role} onChange={handleChange} required className="pl-10"/></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label htmlFor="documentType">Document Type</Label><Select name="documentType" onValueChange={(value) => handleSelectChange("documentType", value)} required><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="CC">Cédula (Colombia)</SelectItem><SelectItem value="CE">Cédula Extranjería (Col)</SelectItem><SelectItem value="SSN">SSN (USA)</SelectItem><SelectItem value="DL">Driver’s License (USA)</SelectItem><SelectItem value="PASS">Passport</SelectItem></SelectGroup></SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="documentNumber">Document Number</Label><div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="documentNumber" name="documentNumber" value={formData.documentNumber} onChange={handleChange} required className="pl-10"/></div></div>
                    </div>
                    <div className="grid gap-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} onFocus={() => setIsPasswordFocused(true)} onBlur={() => setIsPasswordFocused(false)} required className="pl-10 pr-10"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                    {isPasswordFocused && formData.password.length > 0 && <PasswordStrengthIndicator criteria={passwordCriteria} />}
                    <div className="grid gap-2"><Label htmlFor="confirmPassword">Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={handleChange} required className="pl-10 pr-10"/><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground">{showConfirmPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                    <div className="flex items-center space-x-2 mt-2"><Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)} /><label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Accept terms and privacy policy</label></div>
                </CardContent>
                <CardFooter className="flex-col p-0 pt-6 gap-4">
                    <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading || !agreedToTerms || !isPasswordValid}>
                        {isLoading ? "Creating Account..." : <> <UserPlus className="w-4 h-4 mr-2"/> Create Account </>}
                    </Button>
                    <div className="text-center text-sm">Already have an account?{" "}<a href="/login" className="underline" onClick={(e) => { e.preventDefault(); setLocation('/login'); }}>Sign in</a></div>
                </CardFooter>
            </form>
        </Card>
      </div>
       <div className="hidden bg-muted lg:flex items-center justify-center p-10 bg-gradient-to-bl from-slate-900 to-slate-800">
         <GeminiWelcomeRegister />
       </div>
    </div>
  );
}
