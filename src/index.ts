import express from 'express';
import cors from 'cors';
import { setupRoutes } from './routes';
import { initializeChromaDB } from './services/chroma';
import config from 'config';

const app = express();
const port = config.get('port') || 3010;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
initializeChromaDB();

// Setup routes
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
                const path = layer.regexp.source
                    .replace('^\\/', '/')
                    .replace('\\/?(?=\\/|$)', '')
                    .replace(/\\\//g, '/');
                console.log(`${methods} ${path}${route.route.path}`);
            }
        });
    }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`\nServer is running on port ${port}`);
}); 