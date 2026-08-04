const studyGroupService = require('../services/studyGroupService');
const groupService = require('../services/groupService');

function messagePreview(content, attachmentType) {
  if (content && content.trim()) {
    return content.length > 80 ? `${content.slice(0, 77)}...` : content;
  }
  return attachmentType === 'image' ? 'Sent a photo' : 'Sent a file';
}

function registerSocketHandlers(io, sessionMiddleware) {
  // Share the same session with socket.io so we know who's sending each chat message
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', (socket) => {
    // A per-user room lets us push notifications straight to someone's open
    // tabs/devices regardless of which group chat (if any) they're currently
    // viewing — this is what makes the "new message" notification live.
    const userId = socket.request.session?.userId;
    if (userId) socket.join(`user:${userId}`);

    // Prefixed so a study-group id and an accountability-group id can never
    // collide into the same room.
    socket.on('join-study-group', (groupId) => {
      socket.join(`study:${groupId}`);
    });

    socket.on('join-group', (groupId) => {
      socket.join(`group:${groupId}`);
    });

    socket.on('send-message', async (msg) => {
      try {
        const senderId = socket.request.session?.userId;
        if (!senderId) return socket.emit('message-error', 'Not logged in');

        const isMember = await studyGroupService.isMember(msg.studyGroupId, senderId);
        if (!isMember) return socket.emit('message-error', 'Not a member of this group');

        const saved = await studyGroupService.createMessage({
          studyGroupId: msg.studyGroupId,
          senderId,
          content: msg.content || '',
          attachmentUrl: msg.attachmentUrl || '',
          attachmentType: msg.attachmentType || ''
        });
        io.to(`study:${msg.studyGroupId}`).emit('new-message', saved);

        const notifications = await studyGroupService.notifyNewMessage(
          msg.studyGroupId,
          senderId,
          saved.senderId?.name || 'Someone',
          messagePreview(msg.content, msg.attachmentType)
        );
        notifications.forEach((n) => io.to(`user:${n.userId}`).emit('new-notification', n));
      } catch (err) {
        console.error('send-message error:', err.message);
        socket.emit('message-error', 'Could not send message');
      }
    });

    socket.on('send-group-message', async (msg) => {
      try {
        const senderId = socket.request.session?.userId;
        if (!senderId) return socket.emit('group-message-error', 'Not logged in');

        const isMember = await groupService.isMember(msg.groupId, senderId);
        if (!isMember) return socket.emit('group-message-error', 'Not a member of this group');

        const saved = await groupService.createMessage({
          groupId: msg.groupId,
          senderId,
          content: msg.content || '',
          attachmentUrl: msg.attachmentUrl || '',
          attachmentType: msg.attachmentType || ''
        });
        io.to(`group:${msg.groupId}`).emit('new-group-message', saved);

        const notifications = await groupService.notifyNewMessage(
          msg.groupId,
          senderId,
          saved.senderId?.name || 'Someone',
          messagePreview(msg.content, msg.attachmentType)
        );
        notifications.forEach((n) => io.to(`user:${n.userId}`).emit('new-notification', n));
      } catch (err) {
        console.error('send-group-message error:', err.message);
        socket.emit('group-message-error', 'Could not send message');
      }
    });
  });
}

module.exports = registerSocketHandlers;
