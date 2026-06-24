const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3003/api/auth';
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia';

module.exports = async (req, res, next) => {
    const authHeader = req.header('authorization') || req.header('Authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const token = req.header('x-auth-token') || bearerToken;

    if (!token) {
        return res.status(401).json({ message: 'Akses Ditolak! Tidak ada token.' });
    }

    try {
        const response = await axios.post(`${AUTH_SERVICE_URL}/verify`, { token });
        if (response?.data?.valid) {
            req.user = { id: response.data.userId, username: response.data.username };
            return next();
        }

        return res.status(401).json({ message: 'Token tidak valid!' });
    } catch (error) {
        console.warn('⚠️ Auth service verify failed, fallback ke JWT lokal', error.message);

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (verifyError) {
            res.status(401).json({ message: 'Token tidak valid!' });
        }
    }
};