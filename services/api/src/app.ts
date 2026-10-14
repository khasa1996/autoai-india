import { recommendFromApiVehicles } from "@autoai/api-client";
import { estimateEmi, estimateOwnership } from "@autoai/automotive-domain";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { openDatabase } from "./db.js";
import { hashPassword, verifyPassword, hashToken } from "./auth.js";
type User = {
  id: string;
  email: string;
  name: string;
  role: "customer" | "dealer" | "admin";
  password_hash: string;
};
const id = z.string().uuid();
const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) => new URL(v).protocol === "https:",
    "HTTPS provenance URL required",
  );
const short = z.string().trim().min(1).max(160);
const credentials = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const vehicleSchema = z
  .object({
    make: short,
    model: short,
    variant: short,
    fuel: z.enum(["petrol", "diesel", "electric", "hybrid", "cng"]),
    bodyType: short,
    pricePaise: z.number().int().nonnegative().max(1e12),
    sourceUrl: httpsUrl,
    verifiedAt: z.string().datetime(),
    specifications: z
      .record(
        z.string(),
        z.union([z.string().max(300), z.number(), z.boolean()]),
      )
      .default({}),
  })
  .strict();
export function buildApp(
  options: {
    dbPath?: string;
    production?: boolean;
    allowedOrigin?: string;
  } = {},
) {
  if (
    (options.production ?? process.env.NODE_ENV === "production") &&
    !(options.allowedOrigin ?? process.env.APP_ORIGIN)
  )
    throw new Error("Production requires explicit APP_ORIGIN");
  const db = openDatabase(
    options.dbPath ??
      process.env.DATABASE_PATH ??
      `${process.cwd()}/.data/autoai.sqlite`,
  );
  const app = Fastify({ logger: false, bodyLimit: 32768, trustProxy: false });
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const allowedOrigin =
    options.allowedOrigin ?? process.env.APP_ORIGIN ?? "http://localhost:3000";
  const cookieName = production ? "__Host-autoai_session" : "autoai_session";
  const rate = new Map<string, { count: number; expires: number }>();
  app.addHook("onClose", async () => db.close());
  app.addHook("onRequest", async (req, reply) => {
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      ((req.headers.origin && req.headers.origin !== allowedOrigin) ||
        req.headers["sec-fetch-site"] === "cross-site")
    )
      return reply.code(403).send({ error: "Origin is not allowed" });
    const now = Date.now();
    if (rate.size > 10000)
      for (const [key, val] of rate) if (val.expires < now) rate.delete(key);
    const key = `${req.ip}:${req.url.startsWith("/api/auth/") ? "auth" : "general"}`;
    const entry = rate.get(key);
    const limit = key.endsWith(":auth") ? 30 : 300;
    if (entry && entry.expires > now) {
      if (++entry.count > limit)
        return reply
          .code(429)
          .header("Retry-After", "60")
          .send({ error: "Too many requests" });
    } else rate.set(key, { count: 1, expires: now + 60000 });
  });
  app.setErrorHandler((error, req, reply) => {
    const validationError = error as {
      name?: string;
      issues?: Array<{ path: unknown[]; message: string }>;
    };
    if (
      error instanceof ZodError ||
      (validationError.name === "ZodError" &&
        Array.isArray(validationError.issues) &&
        validationError.issues.every(
          (i) => Array.isArray(i.path) && typeof i.message === "string",
        ))
    )
      return reply
        .code(400)
        .send({
          error: "Invalid request",
          issues: validationError.issues!.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply
        .code(status)
        .send({
          error: status === 400 ? "Invalid request" : "Request rejected",
        });
    req.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });
  function current(req: FastifyRequest): User | undefined {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
    return db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(hashToken(token), Date.now()) as User | undefined;
  }
  function auth(req: FastifyRequest, reply: FastifyReply, role?: string) {
    const user = current(req);
    if (!user) {
      reply.code(401).send({ error: "Sign in required" });
      return;
    }
    if (role && user.role !== role) {
      reply.code(403).send({ error: "Access denied" });
      return;
    }
    return user;
  }
  function audit(actor: string, action: string, entity: string) {
    db.prepare(
      "INSERT INTO audit(id,actor_id,action,entity_id) VALUES (?,?,?,?)",
    ).run(randomUUID(), actor, action, entity);
  }
  function session(user: User, reply: FastifyReply) {
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      hashToken(token),
      user.id,
      Date.now() + 86400000,
    );
    reply.header(
      "Set-Cookie",
      `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${production ? "; Secure" : ""}`,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
  function vehicle(row: any) {
    return {
      id: row.id,
      make: row.make,
      model: row.model,
      variant: row.variant,
      fuel: row.fuel,
      bodyType: row.body_type,
      pricePaise: row.price_paise,
      sourceUrl: row.source_url,
      verifiedAt: row.verified_at,
      specifications: JSON.parse(row.specifications),
    };
  }
  app.post("/api/advisor", async (req) => {
    const { customerNeeds } = z
      .object({
        customerNeeds: z
          .object({
            budgetInr: z.number().positive().max(1e10),
            minimumSeats: z.number().int().min(1).max(20),
            preferredFuel: z
              .enum(["petrol", "diesel", "electric", "hybrid", "cng"])
              .optional(),
            preferredTransmission: z.enum(["manual", "automatic"]).optional(),
            preferredBodyStyle: z
              .enum(["hatchback", "sedan", "suv", "mpv", "coupe", "pickup"])
              .optional(),
            requiredFeatures: z
              .array(z.string().trim().min(1).max(120))
              .max(50)
              .default([]),
          })
          .strict(),
      })
      .strict()
      .parse(req.body);
    const rows = db
      .prepare("SELECT * FROM vehicles ORDER BY make,model,id")
      .all()
      .map(vehicle);
    return {
      ...recommendFromApiVehicles(rows, customerNeeds),
      mode: "deterministic",
      disclaimer:
        "Deterministic ranking of reviewed catalogue records; no generative AI provider is configured. Ex-showroom prices exclude taxes, insurance and fees. Dealer confirmation is required.",
    };
  });
  app.post("/api/finance/emi", async (req) => {
    const data = z
      .object({
        principalInr: z.number().finite().min(0).max(1e10),
        annualRatePercent: z.number().finite().min(0).max(100),
        months: z.number().int().min(1).max(600),
      })
      .strict()
      .parse(req.body);
    return estimateEmi(data.principalInr, data.annualRatePercent, data.months);
  });
  app.post("/api/finance/ownership", async (req) => {
    const money = z.number().finite().min(0).max(1e10);
    const data = z
      .object({
        purchaseInr: money,
        registrationInr: money,
        annualInsuranceInr: money,
        annualMaintenanceInr: money,
        annualKm: z.number().finite().min(0).max(1000000),
        energyCostPerKmInr: z.number().finite().min(0).max(10000),
        years: z.number().int().min(1).max(30),
        resaleInr: money,
        financeInterestInr: money.optional(),
      })
      .strict()
      .refine((v) => v.resaleInr <= v.purchaseInr, {
        message: "Resale assumption exceeds purchase price",
        path: ["resaleInr"],
      })
      .parse(req.body);
    return estimateOwnership(data);
  });
  app.get("/api/health", async () => ({
    status: "ok",
    database: "sqlite",
    payments: "unconfigured",
    documentStorage: "unconfigured",
  }));
  app.post("/api/auth/register", async (req, reply) => {
    const data = credentials.extend({ name: short }).parse(req.body);
    if (db.prepare("SELECT id FROM users WHERE email=?").get(data.email))
      return reply.code(409).send({ error: "Unable to register this email" });
    const uid = randomUUID();
    db.prepare(
      "INSERT INTO users(id,email,name,password_hash,role) VALUES (?,?,?,?,?)",
    ).run(uid, data.email, data.name, hashPassword(data.password), "customer");
    reply.code(201);
    return session(
      db.prepare("SELECT * FROM users WHERE id=?").get(uid) as User,
      reply,
    );
  });
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));
  app.post("/api/auth/login", async (req, reply) => {
    const data = credentials.parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(data.email) as User | undefined;
    const valid = verifyPassword(
      data.password,
      user?.password_hash ?? dummyHash,
    );
    if (!user || !valid)
      return reply.code(401).send({ error: "Invalid email or password" });
    return session(user, reply);
  });
  app.get("/api/auth/me", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        hashToken(token),
      );
    reply.header(
      "Set-Cookie",
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production ? "; Secure" : ""}`,
    );
    return { ok: true };
  });
  app.get("/api/catalogue", async (req) => {
    const q = z
      .object({
        query: z.string().max(100).optional(),
        fuel: z.string().max(30).optional(),
        bodyType: z.string().max(80).optional(),
      })
      .parse(req.query);
    const rows = db
      .prepare(
        "SELECT * FROM vehicles WHERE (? IS NULL OR make||' '||model||' '||variant LIKE ?) AND (? IS NULL OR fuel=?) AND (? IS NULL OR body_type=?) ORDER BY make,model LIMIT 100",
      )
      .all(
        q.query ?? null,
        `%${q.query ?? ""}%`,
        q.fuel ?? null,
        q.fuel ?? null,
        q.bodyType ?? null,
        q.bodyType ?? null,
      );
    return { vehicles: rows.map(vehicle) };
  });
  app.get("/api/catalogue/:id", async (req, reply) => {
    const key = id.parse((req.params as any).id);
    const row = db.prepare("SELECT * FROM vehicles WHERE id=?").get(key);
    if (!row) return reply.code(404).send({ error: "Vehicle not found" });
    return {
      vehicle: vehicle(row),
      offers: db
        .prepare(
          "SELECT * FROM offers WHERE vehicle_id=? AND stock>0 AND expires_at>? AND verified_at>?",
        )
        .all(
          key,
          new Date().toISOString(),
          new Date(Date.now() - 86400000).toISOString(),
        ),
    };
  });
  app.post("/api/comparisons", async (req, reply) => {
    const { vehicleIds } = z
      .object({
        vehicleIds: z
          .array(id)
          .min(2)
          .max(4)
          .refine((v) => new Set(v).size === v.length),
      })
      .strict()
      .parse(req.body);
    const rows = vehicleIds.map((key) =>
      db.prepare("SELECT * FROM vehicles WHERE id=?").get(key),
    );
    if (rows.some((v) => !v))
      return reply.code(404).send({ error: "One or more vehicles not found" });
    return { vehicles: rows.map(vehicle) };
  });
  app.get("/api/garage", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    return {
      configurations: db
        .prepare(
          "SELECT g.id,g.vehicle_id AS vehicleId,g.notes,g.created_at AS createdAt,v.make,v.model,v.variant FROM garage g JOIN vehicles v ON v.id=g.vehicle_id WHERE user_id=? ORDER BY g.created_at DESC",
        )
        .all(user.id),
    };
  });
  app.post("/api/garage", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const data = z
      .object({ vehicleId: id, notes: z.string().max(1000).default("") })
      .strict()
      .parse(req.body);
    if (!db.prepare("SELECT id FROM vehicles WHERE id=?").get(data.vehicleId))
      return reply.code(404).send({ error: "Vehicle not found" });
    const key = randomUUID();
    db.prepare(
      "INSERT OR IGNORE INTO garage(id,user_id,vehicle_id,notes) VALUES (?,?,?,?)",
    ).run(key, user.id, data.vehicleId, data.notes);
    return reply
      .code(201)
      .send(
        db
          .prepare(
            "SELECT id,vehicle_id AS vehicleId,notes FROM garage WHERE user_id=? AND vehicle_id=?",
          )
          .get(user.id, data.vehicleId),
      );
  });
  app.delete("/api/garage/:id", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const result = db
      .prepare("DELETE FROM garage WHERE id=? AND user_id=?")
      .run(id.parse((req.params as any).id), user.id);
    return result.changes
      ? { ok: true }
      : reply.code(404).send({ error: "Configuration not found" });
  });
  app.get("/api/bookings", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    return {
      bookings: db
        .prepare(
          "SELECT b.id,b.status,b.price_paise AS pricePaise,b.created_at AS createdAt,v.make,v.model,v.variant FROM bookings b JOIN offers o ON o.id=b.offer_id JOIN vehicles v ON v.id=o.vehicle_id WHERE b.user_id=? ORDER BY b.created_at DESC",
        )
        .all(user.id),
    };
  });
  app.post("/api/bookings", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const { offerId } = z.object({ offerId: id }).strict().parse(req.body);
    const requestKey = z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(req.headers["idempotency-key"]);
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = db
        .prepare(
          "SELECT i.offer_id,b.id,b.status,b.price_paise FROM idempotency i JOIN bookings b ON b.id=i.booking_id WHERE i.user_id=? AND i.key=?",
        )
        .get(user.id, requestKey) as any;
      if (previous) {
        db.exec("COMMIT");
        if (previous.offer_id !== offerId)
          return reply
            .code(409)
            .send({
              error: "Idempotency key already used for a different offer",
            });
        return {
          booking: {
            id: previous.id,
            status: previous.status,
            pricePaise: previous.price_paise,
          },
          replayed: true,
        };
      }
      const offer = db
        .prepare(
          "SELECT o.* FROM offers o JOIN dealers d ON d.id=o.dealer_id WHERE o.id=? AND o.stock>0 AND o.expires_at>? AND o.verified_at>? AND d.accepted_by IS NOT NULL",
        )
        .get(
          offerId,
          new Date().toISOString(),
          new Date(Date.now() - 86400000).toISOString(),
        ) as any;
      if (!offer) {
        db.exec("ROLLBACK");
        return reply
          .code(409)
          .send({ error: "No verified available stock for this offer" });
      }
      const key = randomUUID();
      db.prepare("UPDATE offers SET stock=stock-1 WHERE id=?").run(offerId);
      db.prepare(
        "INSERT INTO bookings(id,user_id,offer_id,status,price_paise) VALUES (?,?,?,'requested',?)",
      ).run(key, user.id, offerId, offer.price_paise);
      db.prepare("INSERT INTO idempotency VALUES (?,?,?,?)").run(
        user.id,
        requestKey,
        offerId,
        key,
      );
      audit(user.id, "booking.requested", key);
      db.exec("COMMIT");
      return reply
        .code(201)
        .send({
          booking: {
            id: key,
            status: "requested",
            pricePaise: offer.price_paise,
          },
          message:
            "Request recorded; no payment collected. Dealer confirmation is required.",
        });
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  });
  app.patch("/api/bookings/:id", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const key = id.parse((req.params as any).id);
    const { status } = z
      .object({ status: z.enum(["confirmed", "cancelled"]) })
      .strict()
      .parse(req.body);
    const booking = db
      .prepare(
        "SELECT b.*,o.dealer_id FROM bookings b JOIN offers o ON b.offer_id=o.id WHERE b.id=?",
      )
      .get(key) as any;
    if (!booking) return reply.code(404).send({ error: "Booking not found" });
    const manager =
      user.role === "admin" ||
      (user.role === "dealer" &&
        Boolean(
          db
            .prepare(
              "SELECT 1 FROM memberships WHERE user_id=? AND dealer_id=?",
            )
            .get(user.id, booking.dealer_id),
        ));
    if (!manager && !(booking.user_id === user.id && status === "cancelled"))
      return reply.code(403).send({ error: "Access denied" });
    const valid =
      (booking.status === "requested" &&
        ["confirmed", "cancelled"].includes(status)) ||
      (booking.status === "confirmed" && status === "cancelled");
    if (!valid)
      return reply.code(409).send({ error: "Invalid booking transition" });
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE bookings SET status=? WHERE id=?").run(status, key);
      if (status === "cancelled")
        db.prepare("UPDATE offers SET stock=stock+1 WHERE id=?").run(
          booking.offer_id,
        );
      audit(user.id, `booking.${status}`, key);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return { booking: { id: key, status } };
  });
  app.get("/api/support", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    return {
      tickets: db
        .prepare(
          "SELECT id,subject,message,status,created_at AS createdAt FROM tickets WHERE user_id=? ORDER BY created_at DESC",
        )
        .all(user.id),
    };
  });
  app.post("/api/support", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const data = z
      .object({ subject: short, message: z.string().trim().min(10).max(5000) })
      .strict()
      .parse(req.body);
    const key = randomUUID();
    db.prepare(
      "INSERT INTO tickets(id,user_id,subject,message) VALUES (?,?,?,?)",
    ).run(key, user.id, data.subject, data.message);
    return reply.code(201).send({ ticket: { id: key, status: "open" } });
  });
  app.post("/api/exchange", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    const data = z
      .object({
        registrationYear: z
          .number()
          .int()
          .min(1980)
          .max(new Date().getFullYear()),
        make: short,
        model: short,
        kilometres: z.number().int().min(0).max(2000000),
      })
      .strict()
      .parse(req.body);
    const key = randomUUID();
    db.prepare(
      "INSERT INTO exchanges(id,user_id,registration_year,make,model,kilometres) VALUES (?,?,?,?,?,?)",
    ).run(
      key,
      user.id,
      data.registrationYear,
      data.make,
      data.model,
      data.kilometres,
    );
    return reply
      .code(201)
      .send({
        request: { id: key, status: "requested" },
        message: "Inspection required; no valuation has been issued.",
      });
  });
  app.get("/api/exchange", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    return {
      requests: db
        .prepare(
          "SELECT id,registration_year AS registrationYear,make,model,kilometres,status FROM exchanges WHERE user_id=?",
        )
        .all(user.id),
    };
  });
  for (const path of ["/api/payments/checkout", "/api/documents/upload"])
    app.post(path, async (req, reply) => {
      if (!auth(req, reply)) return;
      return reply
        .code(503)
        .send({
          error: path.includes("payments")
            ? "Payment provider is not configured. No payment was collected."
            : "Private document storage is not configured. No document was accepted.",
          code: "INTEGRATION_UNAVAILABLE",
        });
    });
  app.post("/api/admin/catalogue", async (req, reply) => {
    const user = auth(req, reply, "admin");
    if (!user) return;
    const v = vehicleSchema.parse(req.body);
    if (Date.parse(v.verifiedAt) > Date.now())
      return reply
        .code(400)
        .send({ error: "Verification date cannot be in the future" });
    const key = randomUUID();
    db.prepare("INSERT INTO vehicles VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      key,
      v.make,
      v.model,
      v.variant,
      v.fuel,
      v.bodyType,
      v.pricePaise,
      v.sourceUrl,
      v.verifiedAt,
      JSON.stringify({ ...v.specifications, verifiedBy: user.id }),
    );
    audit(user.id, "catalogue.created", key);
    return reply
      .code(201)
      .send({
        vehicle: vehicle(
          db.prepare("SELECT * FROM vehicles WHERE id=?").get(key),
        ),
      });
  });
  app.post("/api/admin/dealers", async (req, reply) => {
    const user = auth(req, reply, "admin");
    if (!user) return;
    const { name, sourceUrl, verifiedAt } = z
      .object({
        name: short,
        sourceUrl: httpsUrl,
        verifiedAt: z.string().datetime(),
      })
      .strict()
      .parse(req.body);
    if (Date.parse(verifiedAt) > Date.now())
      return reply
        .code(400)
        .send({ error: "Verification date cannot be future" });
    const key = randomUUID();
    db.prepare("INSERT INTO dealers VALUES (?,?,?,?,?)").run(
      key,
      name,
      sourceUrl,
      verifiedAt,
      user.id,
    );
    audit(user.id, "dealer.created", key);
    return reply.code(201).send({ dealer: { id: key, name } });
  });
  app.post("/api/admin/memberships", async (req, reply) => {
    const user = auth(req, reply, "admin");
    if (!user) return;
    const data = z
      .object({ userId: id, dealerId: id })
      .strict()
      .parse(req.body);
    if (
      !db.prepare("SELECT id FROM users WHERE id=?").get(data.userId) ||
      !db.prepare("SELECT id FROM dealers WHERE id=?").get(data.dealerId)
    )
      return reply.code(404).send({ error: "User or dealer not found" });
    db.prepare("INSERT OR IGNORE INTO memberships VALUES (?,?)").run(
      data.userId,
      data.dealerId,
    );
    db.prepare(
      "UPDATE users SET role='dealer' WHERE id=? AND role='customer'",
    ).run(data.userId);
    audit(user.id, "membership.created", data.userId);
    return { ok: true };
  });
  app.post("/api/offers", async (req, reply) => {
    const user = auth(req, reply);
    if (!user) return;
    if (!["admin", "dealer"].includes(user.role))
      return reply.code(403).send({ error: "Access denied" });
    const data = z
      .object({
        vehicleId: id,
        dealerId: id,
        pricePaise: z.number().int().nonnegative().max(1e12),
        stock: z.number().int().nonnegative().max(10000),
        sourceUrl: httpsUrl,
        verifiedAt: z.string().datetime(),
        expiresAt: z.string().datetime(),
      })
      .strict()
      .parse(req.body);
    if (
      user.role === "dealer" &&
      !db
        .prepare("SELECT 1 FROM memberships WHERE user_id=? AND dealer_id=?")
        .get(user.id, data.dealerId)
    )
      return reply.code(403).send({ error: "Access denied" });
    if (
      Date.parse(data.expiresAt) <= Date.now() ||
      Date.parse(data.verifiedAt) > Date.now() ||
      Date.parse(data.verifiedAt) < Date.now() - 86400000
    )
      return reply
        .code(400)
        .send({ error: "Offer verification and expiry dates are invalid" });
    if (
      !db.prepare("SELECT id FROM vehicles WHERE id=?").get(data.vehicleId) ||
      !db.prepare("SELECT id FROM dealers WHERE id=?").get(data.dealerId)
    )
      return reply.code(404).send({ error: "Vehicle or dealer not found" });
    const key = randomUUID();
    db.prepare("INSERT INTO offers VALUES (?,?,?,?,?,?,?,?)").run(
      key,
      data.vehicleId,
      data.dealerId,
      data.pricePaise,
      data.stock,
      data.sourceUrl,
      data.verifiedAt,
      data.expiresAt,
    );
    audit(user.id, "offer.created", key);
    return reply.code(201).send({ offer: { id: key, ...data } });
  });
  app.get("/api/dealer/dashboard", async (req, reply) => {
    const user = auth(req, reply, "dealer");
    if (!user) return;
    return {
      dealers: db
        .prepare(
          "SELECT d.* FROM dealers d JOIN memberships m ON m.dealer_id=d.id WHERE m.user_id=?",
        )
        .all(user.id),
      offers: db
        .prepare(
          "SELECT o.* FROM offers o JOIN memberships m ON m.dealer_id=o.dealer_id WHERE m.user_id=?",
        )
        .all(user.id),
      bookings: db
        .prepare(
          "SELECT b.id,b.status,b.offer_id,b.price_paise,b.created_at FROM bookings b JOIN offers o ON o.id=b.offer_id JOIN memberships m ON m.dealer_id=o.dealer_id WHERE m.user_id=? ORDER BY b.created_at DESC LIMIT 100",
        )
        .all(user.id),
    };
  });
  app.get("/api/admin/audit", async (req, reply) => {
    if (!auth(req, reply, "admin")) return;
    return {
      events: db
        .prepare("SELECT * FROM audit ORDER BY created_at DESC LIMIT 200")
        .all(),
    };
  });
  app.get("/api/admin/dealers", async (req, reply) => {
    if (!auth(req, reply, "admin")) return;
    return {
      dealers: db
        .prepare("SELECT * FROM dealers ORDER BY name LIMIT 200")
        .all(),
    };
  });
  return app;
}
