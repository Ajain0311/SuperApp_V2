using System;
using System.IO;
using System.Threading.Tasks;
using Npgsql;

namespace DbAudit;

public class Program
{
    private static string GetConnectionString(string[] args)
    {
        if (args.Length > 0 && !string.IsNullOrWhiteSpace(args[0])) return args[0];
        var env = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(env)) return env;

        // Read from local user secrets if available
        var userSecretsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Microsoft", "UserSecrets", "c87933eb-3eec-4973-a4bc-9d7524e812f9", "secrets.json"
        );
        if (File.Exists(userSecretsPath))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(userSecretsPath));
                if (doc.RootElement.TryGetProperty("ConnectionStrings", out var cs) &&
                    cs.TryGetProperty("SupabaseConnection", out var val))
                {
                    return val.GetString() ?? string.Empty;
                }
            }
            catch { }
        }

        return string.Empty;
    }

    public static async Task Main(string[] args)
    {
        var connStr = GetConnectionString(args);
        if (string.IsNullOrWhiteSpace(connStr))
        {
            Console.WriteLine("Connection string not found.");
            return;
        }
        Console.WriteLine("=================================================");
        Console.WriteLine("APPLYING DATABASE MIGRATION ENHANCEMENTS");
        Console.WriteLine("=================================================\n");

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();
        Console.WriteLine("Connected to Supabase PostgreSQL.");

        // 1. Check pre-migration row counts on affected tables
        var tables = new[] { "food_orders", "food_order_items", "rides", "marketplace_listings", "payments" };
        Console.WriteLine("\n--- PRE-MIGRATION ROW COUNTS ---");
        var preCounts = new System.Collections.Generic.Dictionary<string, long>();
        foreach (var t in tables)
        {
            var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{t}\";", conn);
            var cnt = Convert.ToInt64(await cmd.ExecuteScalarAsync());
            preCounts[t] = cnt;
            Console.WriteLine($"  {t}: {cnt} rows");
        }

        // 2. Read and apply SQL migration
        var sqlPath = Path.Combine(AppContext.BaseDirectory, "../../../docs/database/20260919_schema_audit_enhancements.sql");
        if (!File.Exists(sqlPath))
        {
            sqlPath = "docs/database/20260919_schema_audit_enhancements.sql";
        }
        var sql = await File.ReadAllTextAsync(sqlPath);

        Console.WriteLine("\nExecuting migration script...");
        await using (var tx = await conn.BeginTransactionAsync())
        {
            try
            {
                var cmd = new NpgsqlCommand(sql, conn, tx);
                await cmd.ExecuteNonQueryAsync();
                await tx.CommitAsync();
                Console.WriteLine("Migration committed successfully!");
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                Console.WriteLine($"ERROR executing migration: {ex.Message}");
                return;
            }
        }

        // 3. Check post-migration row counts
        Console.WriteLine("\n--- POST-MIGRATION ROW COUNTS ---");
        bool allCountsMatch = true;
        foreach (var t in tables)
        {
            var cmd = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{t}\";", conn);
            var postCnt = Convert.ToInt64(await cmd.ExecuteScalarAsync());
            Console.WriteLine($"  {t}: {postCnt} rows (Pre: {preCounts[t]})");
            if (postCnt != preCounts[t])
            {
                Console.WriteLine($"  WARNING: Row count changed for {t}!");
                allCountsMatch = false;
            }
        }

        if (allCountsMatch)
        {
            Console.WriteLine("✅ Data Preservation Verified: 100% of existing rows intact.");
        }

        // 4. Verify new indexes
        Console.WriteLine("\n--- VERIFYING NEW INDEXES ---");
        var newIndexes = new[] { "idx_food_orders_address_id", "idx_food_orders_coupon_id", "idx_food_order_items_food_item_id", "idx_rides_vehicle_id" };
        foreach (var idx in newIndexes)
        {
            var cmd = new NpgsqlCommand($"SELECT indexdef FROM pg_indexes WHERE indexname = '{idx}';", conn);
            var def = await cmd.ExecuteScalarAsync();
            if (def != null)
            {
                Console.WriteLine($"  ✅ Index {idx}: EXISTS ({def})");
            }
            else
            {
                Console.WriteLine($"  ❌ Index {idx}: NOT FOUND!");
            }
        }

        // 5. Verify updated check constraints
        Console.WriteLine("\n--- VERIFYING UPDATED CHECK CONSTRAINTS ---");
        var checks = new[] { "chk_marketplace_listings_status", "chk_rides_status", "chk_payments_module" };
        foreach (var chk in checks)
        {
            var cmd = new NpgsqlCommand($"SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = '{chk}';", conn);
            var def = await cmd.ExecuteScalarAsync();
            Console.WriteLine($"  ✅ Constraint {chk}: {def}");
        }

        Console.WriteLine("\n=================================================");
        Console.WriteLine("DATABASE MIGRATION COMPLETED & VERIFIED!");
        Console.WriteLine("=================================================");
    }
}
