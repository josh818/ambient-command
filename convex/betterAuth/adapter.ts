/**
 * Better Auth Adapter Functions
 * Shipper auth template version: convex-better-auth-0.12.2+better-auth-1.6.11
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createApi } from "@convex-dev/better-auth";
import schema from "./schema";
import { createAuthOptions } from "../auth";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
