import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
});

try {
  const [result] = await sql`
    select
      current_database() as database,
      current_user as user,
      current_schema() as schema,
      version() as version
  `;

  console.log("✅ PostgreSQL connection successful");
  console.log(`   Database : ${result.database}`);
  console.log(`   User     : ${result.user}`);
  console.log(`   Schema   : ${result.schema}`);
  console.log(`   Server   : ${result.version}`);
} catch (error) {
  console.error("❌ PostgreSQL connection failed");

  if (error instanceof Error) {
    console.error(`   ${error.message}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
} finally {
  await sql.end();
}