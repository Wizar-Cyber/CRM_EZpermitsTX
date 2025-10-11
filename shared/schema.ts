import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, jsonb, doublePrecision, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Leads table - matches houston_311_bcv structure from original app
export const leads = pgTable("houston_311_bcv", {
  id: serial("id").primaryKey(),
  case_number: text("case_number").notNull().unique(),
  incident_address: text("incident_address").notNull(),
  created_date_local: timestamp("created_date_local"),
  resolve_by_time: timestamp("resolve_by_time"),
  ava_case_type: text("ava_case_type"),
  state_code_name: text("state_code_name"),
  zip_code: text("zip_code"),
  created_date_utc: timestamp("created_date_utc"),
  channel: text("channel"),
  extract_date: timestamp("extract_date"),
  latest_case_notes: text("latest_case_notes"),
  created_date: timestamp("created_date"),
  status: text("status").notNull().default("GREEN"), // GREEN, YELLOW, RED
  description: text("description"),
  resolution: text("resolution"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  created_at: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Routes table
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  created_by: text("created_by").notNull(),
  scheduled_on: timestamp("scheduled_on").notNull().defaultNow(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at"),
  points: jsonb("points").notNull(), // Array of {id, address, lat, lng, case_number?}
  route: jsonb("route"), // GeoJSON FeatureCollection from ORS
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// Appointments table
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  case_number: text("case_number").notNull(),
  address: text("address").notNull(),
  scheduled_at: timestamp("scheduled_at").notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  created_at: true,
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
