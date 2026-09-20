import { relations, sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const profiles = pgTable(
    "profiles",
    {
        userId: text("user_id")
            .primaryKey()
            .references(() => user.id, {
                onDelete: "cascade",
            }),

        username: text("username").notNull().unique(),

        displayName: text("display_name"),

        bio: text("bio"),

        avatarUrl: text("avatar_url"),

        countryCode: text("country_code"),

        isPublic: boolean("is_public").notNull().default(true),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        check(
            "profiles_username_length",
           sql`char_length(${table.username}) between 3 and 24`,
        ),

        check(
            "profiles_username_format",
             sql`${table.username} ~ '^[a-zA-Z0-9_]+$'`,
        ),

        check(
            "profiles_country_code_length",
            sql`${table.countryCode} is null or char_length(${table.countryCode}) = 2`,
        ),
    ],
);

export const profilesRelations = relations(profiles, ({ one }) => ({
    user: one(user, {
        fields: [profiles.userId],
        references: [user.id],
    }),
}));