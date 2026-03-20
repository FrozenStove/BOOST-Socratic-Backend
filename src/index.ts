import express from 'express';
import cors from 'cors';
import { setupRoutes } from './routes';
import { initializeFirestore } from './services/firestore';

const app = express();
const port = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin + Firestore at startup
initializeFirestore().catch((error) => {
    console.error('Failed to initialize Firestore, shutting down:', error.message);
    process.exit(1);
});

setupRoutes(app);

// Log all registered routes
console.log('\nRegistered Routes:');
app._router.stack.forEach((layer: any) => {
    if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        console.log(`${methods} ${layer.route.path}`);
    } else if (layer.name === 'router') {
        layer.handle.stack.forEach((route: any) => {
            if (route.route) {
                const methods = Object.keys(route.route.methods).join(', ').toUpperCase();
                const basePath = layer.regexp.source
                    .replace('^\\\/', '/')
                    .replace('\\/?(?=\\/|$)', '')
                    .replace(/\\\//g, '/');
                console.log(`${methods} ${basePath}${route.route.path}`);
            }
        });
    }
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`\nServer is running on port ${port}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
