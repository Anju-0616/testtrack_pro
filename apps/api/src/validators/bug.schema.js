const { z } = require('zod')

const createBugSchema = z.object({
  projectId:        z.number({ required_error: 'projectId is required' }),
  title:            z.string().min(5,  'Title must be at least 5 characters'),
  description:      z.string().min(10, 'Description must be at least 10 characters'),
  stepsToReproduce: z.string().min(5,  'Steps to reproduce must be at least 5 characters'),
  expectedBehavior: z.string().min(5,  'Expected behavior must be at least 5 characters'),
  actualBehavior:   z.string().min(5,  'Actual behavior must be at least 5 characters'),
  severity:         z.enum(['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL']),
  priority:         z.enum(['P1_URGENT', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW']),
  environment:      z.string().optional(),
  affectedVersion:  z.string().optional(),
  assignedToId:     z.number().optional(),
  testCaseId:       z.number().optional(),
  // executionId removed — not a column on Bug table
})

module.exports = { createBugSchema }