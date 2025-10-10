import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertRouteSchema, insertAppointmentSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Leads routes
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
      const leads = await storage.getAllLeads();
      const routes = await storage.getAllRoutes();
      const appointments = await storage.getAllAppointments();
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const newLeads = leads.filter(lead => lead.created_at >= sevenDaysAgo).length;
      
      // Count points in all routes
      const leadsInRoute = routes.reduce((acc, route) => {
        const points = route.points as any[];
        return acc + (points?.length || 0);
      }, 0);
      
      const upcomingAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.scheduled_at);
        return aptDate >= now && aptDate <= sevenDaysFromNow;
      }).length;
      
      // Status breakdown
      const statusBreakdown = {
        GREEN: leads.filter(l => l.status === 'GREEN').length,
        YELLOW: leads.filter(l => l.status === 'YELLOW').length,
        RED: leads.filter(l => l.status === 'RED').length,
        OTHER: leads.filter(l => !['GREEN', 'YELLOW', 'RED'].includes(l.status)).length,
      };
      
      res.json({
        data: {
          totalLeads: leads.length,
          newLeads,
          leadsInRoute,
          upcomingAppointments,
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
