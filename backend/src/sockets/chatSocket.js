const studyGroupService = require('../services/studyGroupService');

function registerSocketHandlers(io, sessionMiddleware) {
  // Share the same session with socket.io so we know who's sending each chat message
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', (socket) => {
    socket.on('join-study-group', (groupId) => {
      socket.join(groupId);
    });

    socket.on('send-message', async (msg) => {
      try {
        const userId = socket.request.session?.userId;
        if (!userId) return socket.emit('message-error', 'Not logged in');

        const isMember = await studyGroupService.isMember(msg.studyGroupId, userId);
        if (!isMember) return socket.emit('message-error', 'Not a member of this group');

        const saved = await studyGroupService.createMessage({
          studyGroupId: msg.studyGroupId,
          senderId: userId,
          content: msg.content || '',
          attachmentUrl: msg.attachmentUrl || '',
          attachmentType: msg.attachmentType || ''
        });
        io.to(msg.studyGroupId).emit('new-message', saved);
      } catch (err) {
        console.error('send-message error:', err.message);
        socket.emit('message-error', 'Could not send message');
      }
    });
  });
}

module.exports = registerSocketHandlers;
