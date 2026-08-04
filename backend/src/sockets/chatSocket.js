const studyGroupService = require('../services/studyGroupService');
const groupService = require('../services/groupService');

function registerSocketHandlers(io, sessionMiddleware) {
  // Share the same session with socket.io so we know who's sending each chat message
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', (socket) => {
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
        io.to(`study:${msg.studyGroupId}`).emit('new-message', saved);
      } catch (err) {
        console.error('send-message error:', err.message);
        socket.emit('message-error', 'Could not send message');
      }
    });

    socket.on('send-group-message', async (msg) => {
      try {
        const userId = socket.request.session?.userId;
        if (!userId) return socket.emit('group-message-error', 'Not logged in');

        const isMember = await groupService.isMember(msg.groupId, userId);
        if (!isMember) return socket.emit('group-message-error', 'Not a member of this group');

        const saved = await groupService.createMessage({
          groupId: msg.groupId,
          senderId: userId,
          content: msg.content || '',
          attachmentUrl: msg.attachmentUrl || '',
          attachmentType: msg.attachmentType || ''
        });
        io.to(`group:${msg.groupId}`).emit('new-group-message', saved);
      } catch (err) {
        console.error('send-group-message error:', err.message);
        socket.emit('group-message-error', 'Could not send message');
      }
    });
  });
}

module.exports = registerSocketHandlers;
