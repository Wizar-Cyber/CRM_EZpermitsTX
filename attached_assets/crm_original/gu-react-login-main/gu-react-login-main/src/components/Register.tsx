import { MdAlternateEmail } from "react-icons/md";
import { FaFingerprint, FaUser, FaPhoneAlt } from "react-icons/fa";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState("");
  const navigate = useNavigate();

  const togglePasswordView = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordView = () =>
    setShowConfirmPassword(!showConfirmPassword);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const fullname = formData.get("fullname") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const role = formData.get("role") as string;
    const documentType = formData.get("documentType") as string;
    const documentNumber = formData.get("documentNumber") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname,
          email,
          phone,
          password,
          role,
          documentType,
          documentNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Registration failed");

      navigate("/login"); // ✅ después de registrarse, va al login
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="w-[90%] max-w-md p-5 bg-gray-900 flex-col flex items-center gap-3 rounded-xl shadow-slate-500 shadow-lg">
        <img src="/logo.png" alt="logo" className="w-12 md:w-14" />
        <h1 className="text-lg md:text-xl font-semibold">Create Account</h1>
        <p className="text-xs md:text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-white hover:underline">
            Login
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          {/* Full name */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <FaUser />
            <input
              type="text"
              name="fullname"
              placeholder="Full Name"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
          </div>

          {/* Email */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <MdAlternateEmail />
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <FaPhoneAlt />
            <input
              type="tel"
              name="phone"
              placeholder="Phone"
              pattern="[0-9]{7,15}"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
          </div>

          {/* Password */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl relative">
            <FaFingerprint />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
              minLength={6}
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

          {/* Confirm Password */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl relative">
            <FaFingerprint />
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
              minLength={6}
            />
            {showConfirmPassword ? (
              <FaRegEyeSlash
                className="absolute right-5 cursor-pointer"
                onClick={toggleConfirmPasswordView}
              />
            ) : (
              <FaRegEye
                className="absolute right-5 cursor-pointer"
                onClick={toggleConfirmPasswordView}
              />
            )}
          </div>

          {/* Role */}
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-xl">
            <FaUser />
            <input
              type="text"
              name="role"
              placeholder="Role"
              className="bg-transparent border-0 w-full outline-none text-sm md:text-base"
              required
            />
          </div>

          {/* Document type + number */}
          <div className="flex gap-2">
            <select
              name="documentType"
              className="bg-gray-800 p-2 rounded-xl text-sm text-gray-400 w-1/2"
              required
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="">Document Type</option>
              <option value="CC">Cédula (Colombia)</option>
              <option value="CE">Cédula Extranjería (Colombia)</option>
              <option value="TI">Tarjeta Identidad (Colombia)</option>
              <option value="NIT">NIT (Colombia)</option>
              <option value="SSN">SSN (US)</option>
              <option value="DL">Driver’s License (US)</option>
              <option value="PASS">Passport</option>
            </select>
            <input
              type="text"
              name="documentNumber"
              placeholder="Document Number"
              className="bg-gray-800 p-2 rounded-xl text-sm w-1/2 outline-none"
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            className="w-full p-2 bg-blue-500 rounded-xl mt-3 hover:bg-blue-600 text-sm md:text-base"
          >
            Register
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
