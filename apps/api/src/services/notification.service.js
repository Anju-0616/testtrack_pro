const prisma = require('../prisma')

const createNotification = async ({
  userId,
  type,
  title,
  message,
  relatedId,
  relatedType,
}) => {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      relatedId,
      relatedType,
    },
  })
}

module.exports = { createNotification }