import { createContext, useContext, useState, ReactNode } from "react";

export type Route = {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  scheduled_on: string;
  updated_at?: string;
  updated_by?: string;
  points?: any[];
  points_count?: number;
  case_numbers?: string[];
};

interface EditingRouteContextType {
  editingRoute: Route | null;
  setEditingRoute: (route: Route | null) => void;
}

const EditingRouteContext = createContext<EditingRouteContextType | null>(null);

export const EditingRouteProvider = ({ children }: { children: ReactNode }) => {
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  return (
    <EditingRouteContext.Provider value={{ editingRoute, setEditingRoute }}>
      {children}
    </EditingRouteContext.Provider>
  );
};

export const useEditingRoute = () => {
  const context = useContext(EditingRouteContext);
  if (!context) {
    throw new Error("useEditingRoute must be used within EditingRouteProvider");
  }
  return context;
};
