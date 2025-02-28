import { checkAndUpdateExpiredTickets } from "../utils/ticket";
import cron from "node-cron";

// Check for expired tickets daily at midnight
export const setupTicketExpirationJob = () => {
    console.log("Setting up ticket expiration job");
    
    cron.schedule("0 0 * * *", async () => {
        console.log("Running ticket expiration check job");
        
        try {
            const updatedCount = await checkAndUpdateExpiredTickets();
            console.log(`${updatedCount} expired tickets have been updated to cancelled`);
        } catch (error) {
            console.error("Error in ticket expiration job:", error);
        }
    });
};
