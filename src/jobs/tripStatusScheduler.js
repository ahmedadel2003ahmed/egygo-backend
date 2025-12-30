import Trip from '../models/Trip.js';
import { TRIP_STATES } from '../utils/tripStateMachine.js';
import { emitTripStatusUpdate } from '../sockets/tripSocketEmitter.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Check for trips that are within 24 hours of starting
 * and update their status to UPCOMING if they are CONFIRMED.
 */
export const checkUpcomingTrips = async () => {
  console.log('[TripScheduler] Checking for upcoming trips...');
  try {
    const now = new Date();
    const future24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const trips = await Trip.find({
      status: TRIP_STATES.CONFIRMED,
      startAt: {
        $gt: now,
        $lte: future24h,
      },
    });

    if (trips.length === 0) {
      console.log('[TripScheduler] No upcoming trips found.');
      return;
    }

    console.log(`[TripScheduler] Found ${trips.length} trips starting within 24h.`);

    for (const trip of trips) {
      trip.status = TRIP_STATES.UPCOMING;
      await trip.save();
      
      console.log(`[TripScheduler] Updated trip ${trip._id} to UPCOMING`);
      emitTripStatusUpdate(trip);
    }
  } catch (error) {
    console.error('[TripScheduler] Error checking upcoming trips:', error);
  }
};

/**
 * Start the trip status scheduler
 */
export const startScheduler = () => {
  // Run immediately on startup (optional, but good for testing)
  // Using setTimeout to let DB connection establish if it hasn't already (though server calls this after DB)
  setTimeout(checkUpcomingTrips, 5000);

  // Schedule interval
  setInterval(checkUpcomingTrips, CHECK_INTERVAL_MS);
  console.log(`[TripScheduler] Scheduler started. Interval: ${CHECK_INTERVAL_MS}ms`);
};
