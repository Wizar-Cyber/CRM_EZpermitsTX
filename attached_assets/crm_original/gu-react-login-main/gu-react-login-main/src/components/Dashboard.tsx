import { Link } from "react-router-dom";
import BackButton from "../components/BackButton";



function Dashboard() {
  return (
    <div className="w-full h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col p-5 shadow-lg">
        <h1 className="text-2xl font-bold mb-8">CRM Panel</h1>
        <nav className="flex flex-col gap-4">
          <Link to="/leads" className="hover:bg-gray-700 px-3 py-2 rounded-md">
            📋 Leads
          </Link>
          <Link to="/map" className="hover:bg-gray-700 px-3 py-2 rounded-md">
            🗺️ Map
          </Link>
          <Link to="/routes" className="hover:bg-gray-700 px-3 py-2 rounded-md">
            🚚 Routes
          </Link>
          <Link
            to="/appointments"
            className="hover:bg-gray-700 px-3 py-2 rounded-md"
          >
            📅 Appointments
          </Link>
        </nav>
        <div className="mt-auto">
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            } }
            className="w-full mt-6 bg-red-500 hover:bg-red-600 py-2 rounded-md"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Content area */}
      <main className="flex-1 bg-gray-100 p-10">
        <h2 className="text-3xl font-bold mb-6">Welcome to the Dashboard 🚀</h2>
        <p className="text-gray-600">
          Use the sidebar to navigate between Leads, Map, Routes and
          Appointments.
        </p>
      </main>
    </div>
  );
}

export default Dashboard;
