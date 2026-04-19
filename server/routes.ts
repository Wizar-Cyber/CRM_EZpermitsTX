import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertRouteSchema, insertAppointmentSchema } from "@shared/schema";
import { ZodError } from "zod";

// JS routes from legacy server
// @ts-ignore
import authRoutes from "./routes/auth.js";
// @ts-ignore
import leadsRoutes from "./routes/leads.js";
// @ts-ignore
import routesRoutes from "./routes/routes.js";
// @ts-ignore
import settingsRouter from "./routes/settings.js";
// @ts-ignore
import clientesRouter from "./routes/clientes.js";
// @ts-ignore
import appointmentsRouter from "./routes/appointments.js";
// @ts-ignore
import dashboardRoutes from "./routes/dashboard.js";
// @ts-ignore
import adminRouter from "./routes/admin.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // JS legacy routes
  app.use("/api/auth", authRoutes);
  app.use("/api/leads", leadsRoutes);
  app.use("/api/routes", routesRoutes);
  app.use("/api/settings", settingsRouter);
  app.use("/api/clientes", clientesRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/admin", adminRouter);

  // TypeScript storage-based routes
  app.get("/api/leads", async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json({ data: leads });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      const lead = await storage.getLeadById(id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ data: lead });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      res.status(201).json({ data: lead });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid lead data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      
      // Validate patch data using partial schema
      const patchSchema = insertLeadSchema.partial();
      const validatedData = patchSchema.parse(req.body);
      
      const lead = await storage.updateLead(id, validatedData);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ data: lead });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid lead data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }
      const success = await storage.deleteLead(id);
      if (!success) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Routes routes (will be implemented in FASE 3.1)
  app.get("/api/routes", async (_req, res) => {
    try {
      const routes = await storage.getAllRoutes();
      res.json({ data: routes });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  // Appointments routes (will be implemented in FASE 3.3)
  app.get("/api/appointments", async (_req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json({ data: appointments });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const statusBreakdown = stats.leadsByStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>);
      
      res.json({
        data: {
          totalLeads: stats.totalLeads,
          newLeads: stats.newLeads,
          leadsInRoute: stats.leadsInRoute,
          upcomingAppointments: stats.upcomingAppointments,
          statusBreakdown,
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
