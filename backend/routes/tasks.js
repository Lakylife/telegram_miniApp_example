//routes/tasks.js
const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');

router.get('/:id', tasksController.getUserTasks);
router.post('/update', tasksController.updateTaskStatus);
router.post('/complete', tasksController.completeTask);

module.exports = router;
