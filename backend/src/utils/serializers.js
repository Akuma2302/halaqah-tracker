// Keeps the API response shape stable (Mongo-style `_id`, camelCase, populated
// refs) so the existing React frontend needs no changes even though the data
// now lives in Postgres instead of MongoDB.

function serializeUser(row) {
  if (!row) return null;
  return {
    _id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    kampus: row.kampus,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeGroup(row, memberRows = []) {
  return {
    _id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    members: memberRows.map((m) => ({ userId: m.user_id, joinedAt: m.joined_at })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeStudyGroup(row, memberRows = []) {
  return {
    _id: row.id,
    name: row.name,
    subject: row.subject,
    adminId: row.admin_id,
    inviteCode: row.invite_code,
    members: memberRows.map((m) => ({ userId: m.user_id, role: m.role, joinedAt: m.joined_at })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Detail view: members/schedule fully populated (mirrors the old .populate() calls)
function serializeStudyGroupDetail(row, memberRows, usersById, scheduleRows) {
  return {
    _id: row.id,
    name: row.name,
    subject: row.subject,
    adminId: row.admin_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members: memberRows.map((m) => ({
      userId: serializeUser(usersById[m.user_id]),
      role: m.role,
      joinedAt: m.joined_at
    })),
    schedule: scheduleRows.map((s) => ({
      _id: s.id,
      title: s.title,
      datetime: s.datetime,
      notes: s.notes,
      reminded: s.reminded,
      createdAt: s.created_at
    }))
  };
}

function serializeMessage(row) {
  return {
    _id: row.id,
    studyGroupId: row.study_group_id,
    content: row.content,
    attachmentUrl: row.attachment_url,
    attachmentType: row.attachment_type,
    createdAt: row.created_at,
    senderId: row.sender
      ? { _id: row.sender.id, name: row.sender.name, avatarUrl: row.sender.avatar_url }
      : { _id: row.sender_id }
  };
}

function serializeNotification(row) {
  return {
    _id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    relatedId: row.related_id,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

function serializeContentItem(row) {
  return {
    _id: row.id,
    category: row.category,
    title: row.title,
    arabicText: row.arabic_text,
    transliteration: row.transliteration,
    translation: row.translation,
    order: row.sort_order
  };
}

module.exports = {
  serializeUser,
  serializeGroup,
  serializeStudyGroup,
  serializeStudyGroupDetail,
  serializeMessage,
  serializeNotification,
  serializeContentItem
};
