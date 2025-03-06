import { prismaClient } from "../client";
import cron from "node-cron";

// Check for expired tickets daily at midnight
export const setupTicketExpirationJob = () => {
    console.log("Setting up ticket expiration job");

    cron.schedule("0 0 * * *", async () => {
        console.log("Running ticket expiration check job");

        try {
            // Get current date
            const now = new Date();

            // Find tickets whose appointments have passed and are more than 3 days old
            const expiredTickets = await prismaClient.ticket.updateMany({
                where: {
                    status: { in: ["active", "scheduled"] },
                    expires_at: { lt: now },
                    appointment: {
                        date: { lt: now } // Only check tickets for appointments that have already occurred
                    }
                },
                data: {
                    status: "cancelled"
                }
            });

            console.log(`${expiredTickets.count} expired tickets have been updated to cancelled`);
        } catch (error) {
            console.error("Error in ticket expiration job:", error);
        }
    });
};
