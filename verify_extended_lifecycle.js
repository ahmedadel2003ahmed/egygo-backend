import 'dotenv/config';
import mongoose from 'mongoose';
import Trip from './src/models/Trip.js';
import User from './src/models/User.js';
import Guide from './src/models/Guide.js';
import { TRIP_STATES } from './src/utils/tripStateMachine.js';
import { checkUpcomingTrips } from './src/jobs/tripStatusScheduler.js';
import tripService from './src/services/tripService.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/localguide';

const runVerification = async () => {
    console.log('🚀 Starting Extended Trip Lifecycle Verification...');
    let tripId = null;
    let exitCode = 0;

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Setup Data
        const guide = await Guide.findOne().populate('user');
        const tourist = await User.findOne({ role: 'tourist' });

        if (!guide || !tourist) {
            throw new Error('❌ Need at least one guide and one tourist in DB to run this test.');
        }

        console.log(`ℹ️  Using Guide: ${guide.user?.name} (${guide._id})`);
        
        // Create a CONFIRMED trip starting in 2 hours
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 2);

        const tripData = {
            tourist: tourist._id,
            guide: guide._id,
            selectedGuide: guide._id,
            startAt: startTime,
            status: TRIP_STATES.CONFIRMED,
            negotiatedPrice: 100,
            meetingPoint: {
                type: 'Point',
                coordinates: [31.2357, 30.0444]
            }
        };

        const trip = await Trip.create(tripData);
        tripId = trip._id;
        console.log(`\n✅ Step 1: Created CONFIRMED trip ${trip._id} starting at ${startTime.toISOString()}`);

        // 2. Test Scheduler
        console.log('\n⏳ Step 2: Running Scheduler...');
        await checkUpcomingTrips();

        const upcomingTrip = await Trip.findById(tripId);
        if (upcomingTrip.status === TRIP_STATES.UPCOMING) {
            console.log('✅ Scheduler Success: Status is UPCOMING');
        } else {
            throw new Error(`❌ Scheduler Failed! Status: ${upcomingTrip.status}`);
        }

        // 3. Test Start Trip
        console.log('\n⏳ Step 3: Starting Trip...');
        const guideProfileId = guide._id.toString();
        await tripService.startTrip(guideProfileId, tripId.toString());
        
        const inProgressTrip = await Trip.findById(tripId);
        if (inProgressTrip.status === TRIP_STATES.IN_PROGRESS) {
             console.log('✅ Start Trip Success: Status is IN_PROGRESS');
        } else {
             throw new Error(`❌ Start Trip Failed! Status: ${inProgressTrip.status}`);
        }

        // 4. Test End Trip
        console.log('\n⏳ Step 4: Ending Trip...');
        await tripService.endTrip(guideProfileId, tripId.toString());
        
        const completedTrip = await Trip.findById(tripId);
        if (completedTrip.status === TRIP_STATES.COMPLETED) {
             console.log('✅ End Trip Success: Status is COMPLETED');
        } else {
             throw new Error(`❌ End Trip Failed! Status: ${completedTrip.status}`);
        }

        console.log('\n✨ ALL TESTS PASSED! ✨');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error);
        exitCode = 1;
    } finally {
        if (tripId) {
            try {
                await Trip.findByIdAndDelete(tripId);
                console.log('🧹 Cleanup: Test trip deleted.');
            } catch (cleanupError) {
                console.error('⚠️ Cleanup failed:', cleanupError.message);
            }
        }
        await mongoose.connection.close();
        process.exit(exitCode);
    }
};

runVerification();
