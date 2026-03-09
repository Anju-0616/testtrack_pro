const prisma = require('../prisma')

/**
 * Create a single notification for one user.
 */
const createNotification = async ({ userId, type, title, message, relatedId, relatedType }) => {
  if (!userId) return null
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, relatedId, relatedType }
    })
  } catch (err) {
    console.error('createNotification error:', err)
    return null
  }
}

/**
 * Create notifications for multiple users at once (filters out nulls/duplicates).
 */
const createNotificationForMany = async (userIds, payload) => {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (!unique.length) return
  try {
    await prisma.notification.createMany({
      data: unique.map(userId => ({ userId, ...payload })),
      skipDuplicates: true
    })
  } catch (err) {
    console.error('createNotificationForMany error:', err)
  }
}

/**
 * Fire the right notification(s) for every bug status transition.
 *
 * Actors involved:
 *   - createdById  → the tester who reported the bug
 *   - assignedToId → the developer working on it
 *   - actorId      → whoever triggered this action (to avoid self-notifying)
 */
const notifyBugTransition = async ({ bug, newStatus, actorId, fixNotes }) => {
  const { id, bugId, createdById, assignedToId } = bug
  const relatedId   = id.toString()
  const relatedType = 'BUG'

  // Helper: notify everyone except the actor
  const notify = (userIds, type, title, message) =>
    createNotificationForMany(
      userIds.filter(uid => uid && uid !== actorId),
      { type, title, message, relatedId, relatedType }
    )

  switch (newStatus) {

    // Tester accepted the bug → tell the assigned developer (if any)
    case 'OPEN':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_ACCEPTED',
          'Bug Accepted',
          `Bug ${bugId} has been accepted and is ready for you to start work.`)
      }
      break

    // Developer started work → tell the reporter
    case 'IN_PROGRESS':
      await notify([createdById], 'BUG_IN_PROGRESS',
        'Bug In Progress',
        `A developer has started working on bug ${bugId}.`)
      break

    // Developer marked fixed → tell the reporter to verify
    case 'FIXED':
      await notify([createdById], 'BUG_FIXED',
        'Bug Fixed — Ready for Re-test',
        `Bug ${bugId} has been marked as FIXED.${fixNotes ? ` Notes: "${fixNotes}"` : ''} Please verify.`)
      break

    // Tester verified the fix → tell the developer
    case 'VERIFIED':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_VERIFIED',
          'Bug Verified ✓',
          `Bug ${bugId} has been verified by the tester.`)
      }
      break

    // Tester closed the bug → tell the developer
    case 'CLOSED':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_CLOSED',
          'Bug Closed',
          `Bug ${bugId} has been closed.`)
      }
      break

    // Tester reopened after fix → tell the developer
    case 'REOPENED':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_REOPENED',
          'Bug Reopened',
          `Bug ${bugId} was reopened — the fix needs more work.`)
      }
      // Also tell the reporter it's being revisited
      await notify([createdById], 'BUG_REOPENED',
        'Bug Reopened',
        `Bug ${bugId} has been reopened for rework.`)
      break

    // Tester marked won't fix → tell developer (if assigned)
    case 'WONT_FIX':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_WONT_FIX',
          "Bug Won't Fix",
          `Bug ${bugId} has been marked as Won't Fix.`)
      }
      break

    // Tester marked duplicate → tell developer (if assigned)
    case 'DUPLICATE':
      if (assignedToId) {
        await notify([assignedToId], 'BUG_DUPLICATE',
          'Bug Marked Duplicate',
          `Bug ${bugId} has been marked as a duplicate.`)
      }
      break

    default:
      break
  }
}

/**
 * Fire notification when a bug is assigned to a developer.
 */
const notifyBugAssigned = async ({ bug, assignedToId, actorId }) => {
  if (!assignedToId || assignedToId === actorId) return
  await createNotification({
    userId:      assignedToId,
    type:        'BUG_ASSIGNED',
    title:       'New Bug Assigned to You',
    message:     `Bug ${bug.bugId} has been assigned to you.`,
    relatedId:   bug.id.toString(),
    relatedType: 'BUG'
  })
}

/**
 * Fire notification when a comment is added.
 */
const notifyBugComment = async ({ bug, actorId, actorRole }) => {
  // Notify the other party
  const notifyUserId = actorRole === 'DEVELOPER' ? bug.createdById : bug.assignedToId
  if (!notifyUserId || notifyUserId === actorId) return
  await createNotification({
    userId:      notifyUserId,
    type:        'BUG_COMMENT',
    title:       'New Comment on Bug',
    message:     `A new comment was added on bug ${bug.bugId}.`,
    relatedId:   bug.id.toString(),
    relatedType: 'BUG'
  })
}

module.exports = {
  createNotification,
  createNotificationForMany,
  notifyBugTransition,
  notifyBugAssigned,
  notifyBugComment
}