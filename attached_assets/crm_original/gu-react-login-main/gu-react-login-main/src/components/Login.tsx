import { MdAlternateEmail } from "react-icons/md";
import { FaFingerprint, FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth"; // ✅ usamos el hook

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth(); // ✅ del contexto
  const navigate = useNavigate();

  const togglePasswordView = () => setShowPassword(!showPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Login failed");

      login(data.token); // ✅ guardamos el token en el contexto/localStorage
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="w-[90%] max-w-sm md:max-w-md p-5 bg-gray-900 flex-col flex items-center gap-3 rounded-xl shadow-slate-500 shadow-lg">
        <img src="/logo.png" alt="logo" className="w-12 md:w-14" />
        <h1 className="text-lg md:text-xl font-semibold">Welcome back</h1>
        <p className="text-xs md:text-sm text-gray-500 text-center">
          Don’t have an account?{" "}
          <Link to="/register" className="text-white hover:underline">
            Register
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          {/* Email */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <MdAlternateEmail />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
          </div>

          {/* Password */}
          <div className="w-full flex items-center gap-2 bg-gray-800 p-2 rounded-xl relative">
            <FaFingerprint />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
            {showPassword ? (
              <FaRegEyeSlash
                className="absolute right-5 cursor-pointer"
                onClick={togglePasswordView}
              />
            ) : (
              <FaRegEye
                className="absolute right-5 cursor-pointer"
                onClick={togglePasswordView}
              />
            )}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            className="w-full p-2 bg-blue-500 rounded-xl mt-3 hover:bg-blue-600 text-sm md:text-base"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
