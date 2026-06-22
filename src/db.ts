import dns from "node:dns";
import mongoose from "mongoose";

// Windows sometimes prefers an IPv6 link-local resolver that can't answer
// SRV queries, breaking mongodb+srv:// lookups. Force a public resolver.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
