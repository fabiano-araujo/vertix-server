import userRoutes from "./user.routes";
import authRoutes from "./auth.routes";
import pixPaymentRoutes from "./pix.payment.routes";
import subscriptionRoutes from "./subscription.routes";
import subscriptionPaymentRoutes from "./subscription.payment.routes";
import aiRoutes from "./ai.routes";
import creditsRoutes from "./credits.routes";

// VERTIX Streaming Routes
import seriesRoutes from "./series.routes";
import episodeRoutes from "./episode.routes";
import feedRoutes from "./feed.routes";
import commentRoutes from "./comment.routes";
import searchRoutes from "./search.routes";
import adminRoutes from "./admin.routes";

const router = (app: any) => {
    // Existing routes
    userRoutes(app);
    authRoutes(app);
    pixPaymentRoutes(app);
    subscriptionRoutes(app);
    subscriptionPaymentRoutes(app);
    aiRoutes(app);
    creditsRoutes(app);

    // VERTIX Streaming routes
    seriesRoutes(app);
    episodeRoutes(app);
    feedRoutes(app);
    commentRoutes(app);
    searchRoutes(app);
    adminRoutes(app);
}

export default router;