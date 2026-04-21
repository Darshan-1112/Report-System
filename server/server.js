const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();


const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');


const app = express();

// --- MIDDLEWARE ---
app.use(helmet()); // Adds security headers
app.use(cors({
    origin: "http://localhost:3000", // Your Frontend Port
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));   // Enables Cross-Origin Resource Sharing
app.use(morgan('dev')); // Logs requests to console
app.use(express.json()); // Parses JSON bodies

// --- ROUTES ---
// We will import these once files are created
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Root Route
app.get('/', (req, res) => {
    res.json({ message: "Employee Reporting API is running..." });
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});