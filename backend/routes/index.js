const express = require('express');
const router = express.Router();
const tasksRoutes = require('./tasks');
const usersRoutes = require('./users');
const referralsRoutes = require('./referrals');

// Přidání rout pro tasks
router.use('/tasks', tasksRoutes);
// Přidání rout pro users
router.use('/users', usersRoutes);
// Přidání rout pro referrals
router.use('/referrals', referralsRoutes);

module.exports = router;
