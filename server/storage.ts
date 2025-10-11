import { 
  type User, 
  type InsertUser,
  type Lead,
  type InsertLead,
  type Route,
  type InsertRoute,
  type Appointment,
  type InsertAppointment,
  users,
  leads,
  routes,
  appointments
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, sql as sqlTag } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Leads
  getAllLeads(): Promise<Lead[]>;
  getLeadById(id: number): Promise<Lead | undefined>;
  getLeadByCaseNumber(caseNumber: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // Routes
  getAllRoutes(): Promise<Route[]>;
  getRouteById(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: number, route: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  
  // Appointments
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentById(id: number): Promise<Appointment | undefined>;
  getAppointmentsByCaseNumber(caseNumber: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // Dashboard
  getDashboardStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    leadsInRoute: number;
    upcomingAppointments: number;
    leadsByStatus: { status: string; count: number }[];
  }>;
}

// PostgreSQL Storage using Drizzle ORM
export class DrizzleStorage implements IStorage {
  private db;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    const sql = neon(databaseUrl);
    this.db = drizzle(sql);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Lead methods
  async getAllLeads(): Promise<Lead[]> {
    return await this.db.select().from(leads);
  }

  async getLeadById(id: number): Promise<Lead | undefined> {
    const result = await this.db.select().from(leads).where(eq(leads.id, id));
    return result[0];
  }

  async getLeadByCaseNumber(caseNumber: string): Promise<Lead | undefined> {
    const result = await this.db.select().from(leads).where(eq(leads.case_number, caseNumber));
    return result[0];
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const result = await this.db.insert(leads).values(insertLead).returning();
    return result[0];
  }

  async updateLead(id: number, updateData: Partial<InsertLead>): Promise<Lead | undefined> {
    const result = await this.db.update(leads).set(updateData).where(eq(leads.id, id)).returning();
    return result[0];
  }

  async deleteLead(id: number): Promise<boolean> {
    const result = await this.db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  // Route methods
  async getAllRoutes(): Promise<Route[]> {
    return await this.db.select().from(routes);
  }

  async getRouteById(id: number): Promise<Route | undefined> {
    const result = await this.db.select().from(routes).where(eq(routes.id, id));
    return result[0];
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const result = await this.db.insert(routes).values(insertRoute).returning();
    return result[0];
  }

  async updateRoute(id: number, updateData: Partial<InsertRoute>): Promise<Route | undefined> {
    const result = await this.db.update(routes).set({
      ...updateData,
      updated_at: new Date()
    }).where(eq(routes.id, id)).returning();
    return result[0];
  }

  async deleteRoute(id: number): Promise<boolean> {
    const result = await this.db.delete(routes).where(eq(routes.id, id)).returning();
    return result.length > 0;
  }

  // Appointment methods
  async getAllAppointments(): Promise<Appointment[]> {
    return await this.db.select().from(appointments);
  }

  async getAppointmentById(id: number): Promise<Appointment | undefined> {
    const result = await this.db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }

  async getAppointmentsByCaseNumber(caseNumber: string): Promise<Appointment[]> {
    return await this.db.select().from(appointments).where(eq(appointments.case_number, caseNumber));
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const result = await this.db.insert(appointments).values(insertAppointment).returning();
    return result[0];
  }

  async updateAppointment(id: number, updateData: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const result = await this.db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return result[0];
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await this.db.delete(appointments).where(eq(appointments.id, id)).returning();
    return result.length > 0;
  }

  async getDashboardStats(): Promise<{
    totalLeads: number;
    newLeads: number;
    leadsInRoute: number;
    upcomingAppointments: number;
    leadsByStatus: { status: string; count: number }[];
  }> {
    // Get total leads
    const totalLeadsResult = await this.db.select({ count: sqlTag<number>`count(*)` }).from(leads);
    const totalLeads = Number(totalLeadsResult[0]?.count || 0);

    // Get new leads (last 7 days) - using created_date_local which is the actual lead creation date
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newLeadsResult = await this.db.select({ count: sqlTag<number>`count(*)` })
      .from(leads)
      .where(sqlTag`${leads.created_date_local} IS NOT NULL AND ${leads.created_date_local} >= ${sevenDaysAgo}`);
    const newLeads = Number(newLeadsResult[0]?.count || 0);

    // Get leads in routes (count distinct lead ids in route points)
    const routesData = await this.db.select({ points: routes.points }).from(routes);
    const uniqueLeadIds = new Set<string>();
    routesData.forEach(route => {
      const points = route.points as any[];
      if (Array.isArray(points)) {
        points.forEach(point => {
          if (point.case_number) {
            uniqueLeadIds.add(point.case_number);
          }
        });
      }
    });
    const leadsInRoute = uniqueLeadIds.size;

    // Get upcoming appointments (next 7 days)
    const nextSevenDays = new Date();
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);
    const upcomingApptsResult = await this.db.select({ count: sqlTag<number>`count(*)` })
      .from(appointments)
      .where(sqlTag`${appointments.scheduled_at} >= ${new Date()} AND ${appointments.scheduled_at} <= ${nextSevenDays}`);
    const upcomingAppointments = Number(upcomingApptsResult[0]?.count || 0);

    // Get leads by status
    const leadsByStatusResult = await this.db.select({
      status: leads.status,
      count: sqlTag<number>`count(*)`
    }).from(leads).groupBy(leads.status);

    const leadsByStatus = leadsByStatusResult.map(row => ({
      status: row.status || 'UNKNOWN',
      count: Number(row.count || 0)
    }));

    return {
      totalLeads,
      newLeads,
      leadsInRoute,
      upcomingAppointments,
      leadsByStatus
    };
  }
}

// Use DrizzleStorage with PostgreSQL
export const storage = new DrizzleStorage();
