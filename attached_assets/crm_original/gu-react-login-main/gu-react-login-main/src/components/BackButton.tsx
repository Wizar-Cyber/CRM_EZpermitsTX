import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)} // 🔙 vuelve a la página anterior
      className="mb-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
    >
       Back
    </button>
  );
}
