import { MongoClient } from "mongodb";

const globalForMongo = globalThis;

export async function getMongoStoreCollection() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect().catch((error) => {
      delete globalForMongo.mongoClientPromise;
      throw error;
    });
  }

  const client = await globalForMongo.mongoClientPromise;
  const database = process.env.MONGODB_DB?.trim() || "marketplace_intelligence";
  return client.db(database).collection("app_store");
}
