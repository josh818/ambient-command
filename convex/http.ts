/**
 * Convex HTTP Routes
 * Required for Better Auth route handling
 * @see https://convex-better-auth.netlify.app/
 */
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes with CORS enabled for client-side frameworks
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
