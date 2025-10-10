import { 
  type User, 
  type InsertUser,
  type Lead,
  type InsertLead,
  type Route,
  type InsertRoute,
  type Appointment,
  type InsertAppointment
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: Map<number, Lead>;
  private routes: Map<number, Route>;
  private appointments: Map<number, Appointment>;
  private leadIdCounter: number;
  private routeIdCounter: number;
  private appointmentIdCounter: number;

  constructor() {
    this.users = new Map();
    this.leads = new Map();
    this.routes = new Map();
    this.appointments = new Map();
    this.leadIdCounter = 1;
    this.routeIdCounter = 1;
    this.appointmentIdCounter = 1;
    
    // Initialize with some mock leads for testing
    this.initializeMockLeads();
  }

  private initializeMockLeads() {
    const mockLeads: InsertLead[] = [
      { case_number: "C-2024-001", incident_address: "123 Main St, City, State", status: "GREEN", priority: "High", date: new Date("2024-01-15") },
      { case_number: "C-2024-002", incident_address: "456 Oak Ave, City, State", status: "YELLOW", priority: "Medium", date: new Date("2024-01-16") },
      { case_number: "C-2024-003", incident_address: "789 Pine Rd, City, State", status: "RED", priority: "Low", date: new Date("2024-01-17") },
      { case_number: "C-2024-004", incident_address: "321 Elm St, City, State", status: "GREEN", priority: "High", date: new Date("2024-01-18") },
      { case_number: "C-2024-005", incident_address: "654 Maple Dr, City, State", status: "YELLOW", priority: "Medium", date: new Date("2024-01-19") },
    ];
    
    mockLeads.forEach(lead => {
      this.createLead(lead);
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Lead methods
  async getAllLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values());
  }

  async getLeadById(id: number): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getLeadByCaseNumber(caseNumber: string): Promise<Lead | undefined> {
    return Array.from(this.leads.values()).find(
      (lead) => lead.case_number === caseNumber,
    );
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = this.leadIdCounter++;
    const lead: Lead = {
      id,
      case_number: insertLead.case_number,
      incident_address: insertLead.incident_address,
      status: insertLead.status ?? "GREEN",
      priority: insertLead.priority ?? "Medium",
      date: insertLead.date ?? new Date(),
      lat: insertLead.lat ?? null,
      lng: insertLead.lng ?? null,
      created_at: new Date(),
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: number, updateData: Partial<InsertLead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead = { ...lead, ...updateData };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async deleteLead(id: number): Promise<boolean> {
    return this.leads.delete(id);
  }

  // Route methods
  async getAllRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }

  async getRouteById(id: number): Promise<Route | undefined> {
    return this.routes.get(id);
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const id = this.routeIdCounter++;
    const route: Route = {
      id,
      name: insertRoute.name,
      created_by: insertRoute.created_by,
      scheduled_on: insertRoute.scheduled_on ?? new Date(),
      points: insertRoute.points,
      route: insertRoute.route ?? null,
      created_at: new Date(),
    };
    this.routes.set(id, route);
    return route;
  }

  async updateRoute(id: number, updateData: Partial<InsertRoute>): Promise<Route | undefined> {
    const route = this.routes.get(id);
    if (!route) return undefined;
    
    const updatedRoute = { ...route, ...updateData };
    this.routes.set(id, updatedRoute);
    return updatedRoute;
  }

  async deleteRoute(id: number): Promise<boolean> {
    return this.routes.delete(id);
  }

  // Appointment methods
  async getAllAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async getAppointmentById(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async getAppointmentsByCaseNumber(caseNumber: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      (appointment) => appointment.case_number === caseNumber,
    );
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentIdCounter++;
    const appointment: Appointment = {
      id,
      case_number: insertAppointment.case_number,
      address: insertAppointment.address,
      scheduled_at: insertAppointment.scheduled_at,
      notes: insertAppointment.notes ?? null,
      created_at: new Date(),
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: number, updateData: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment = { ...appointment, ...updateData };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    return this.appointments.delete(id);
  }
}

export const storage = new MemStorage();
