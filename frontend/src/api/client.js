import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }).then(r => r.data),
  updateEmail: (email) => api.put('/auth/me', { email }).then(r => r.data),
}

export const meApi = {
  getProfile: () => api.get('/me').then(r => r.data),
  getTeam: () => api.get('/me/team').then(r => r.data),
  getCalendar: () => api.get('/me/calendar').then(r => r.data),
  getReports: () => api.get('/me/reports').then(r => r.data),
  getFullProfile: () => api.get('/me/profile').then(r => r.data),
  updateFullProfile: (data) => api.put('/me/profile', data).then(r => r.data),
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}

export const reportEntriesApi = {
  getMine: () => api.get('/me/report-entries').then(r => r.data),
  getMineOne: (id) => api.get(`/me/report-entries/${id}`).then(r => r.data),
  create: (date) => api.post('/me/report-entries', { date }).then(r => r.data),
  update: (id, days, submit) => api.put(`/me/report-entries/${id}`, { days, submit }).then(r => r.data),
  getAll: (params) => api.get('/report-entries', { params }).then(r => r.data),
  getOne: (id) => api.get(`/report-entries/${id}`).then(r => r.data),
  review: (id, status, comment) => api.put(`/report-entries/${id}/review`, { status, comment }).then(r => r.data),
}

export const usersApi = {
  getAll: () => api.get('/users').then(r => r.data),
  getOne: (id) => api.get(`/users/${id}`).then(r => r.data),
  create: (data) => api.post('/users', data).then(r => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then(r => r.data),
  updateProfile: (id, data) => api.put(`/users/${id}/profile`, data).then(r => r.data),
  uploadAvatar: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/users/${id}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  resetPassword: (id) => api.post(`/users/${id}/reset-password`).then(r => r.data),
  delete: (id) => api.delete(`/users/${id}`).then(r => r.data),
}

export const permissionRolesApi = {
  getAll: () => api.get('/permission-roles').then(r => r.data),
  create: (data) => api.post('/permission-roles', data).then(r => r.data),
  update: (id, data) => api.put(`/permission-roles/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/permission-roles/${id}`).then(r => r.data),
}

export const locationsApi = {
  getAll: () => api.get('/locations').then(r => r.data),
  create: (data) => api.post('/locations', data).then(r => r.data),
  update: (id, data) => api.put(`/locations/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/locations/${id}`).then(r => r.data),
}

export const calendarApi = {
  getAll: (start, end) => api.get('/calendar', { params: { start, end } }).then(r => r.data),
  create: (data) => api.post('/calendar', data).then(r => r.data),
  update: (id, data) => api.put(`/calendar/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/calendar/${id}`).then(r => r.data),
}

export const todosApi = {
  getAll: (status) => api.get('/todos', { params: status ? { status } : {} }).then(r => r.data),
  create: (data) => api.post('/todos', data).then(r => r.data),
  update: (id, data) => api.put(`/todos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/todos/${id}`).then(r => r.data),
}

export const notesApi = {
  getAll: () => api.get('/notes').then(r => r.data),
  create: (data) => api.post('/notes', data).then(r => r.data),
  update: (id, data) => api.put(`/notes/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/notes/${id}`).then(r => r.data),
}

export const departmentsApi = {
  getAll: () => api.get('/departments').then(r => r.data),
  create: (data) => api.post('/departments', data).then(r => r.data),
  update: (id, data) => api.put(`/departments/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/departments/${id}`).then(r => r.data),
}

export const azubisApi = {
  getAll: () => api.get('/azubis').then(r => r.data),
  getByDepartment: () => api.get('/azubis/by-department').then(r => r.data),
  getNextRotation: () => api.get('/azubis/next-rotation').then(r => r.data),
  getBirthdays: () => api.get('/azubis/birthdays').then(r => r.data),
  bulkRotation: (assignments, rotation_date) => api.post('/azubis/rotation', { assignments, rotation_date }).then(r => r.data),
}

export const announcementsApi = {
  getActive: () => api.get('/announcements').then(r => r.data),
  getAll: () => api.get('/announcements/all').then(r => r.data),
  create: (data) => api.post('/announcements', data).then(r => r.data),
  update: (id, data) => api.put(`/announcements/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/announcements/${id}`).then(r => r.data),
}

export const schoolsApi = {
  getAll: () => api.get('/schools').then(r => r.data),
  create: (data) => api.post('/schools', data).then(r => r.data),
  update: (id, data) => api.put(`/schools/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/schools/${id}`).then(r => r.data),
  getBlocks: (schoolId) => api.get(`/schools/${schoolId}/blocks`).then(r => r.data),
  createBlock: (schoolId, data) => api.post(`/schools/${schoolId}/blocks`, data).then(r => r.data),
  updateBlock: (blockId, data) => api.put(`/schools/blocks/${blockId}`, data).then(r => r.data),
  deleteBlock: (blockId) => api.delete(`/schools/blocks/${blockId}`).then(r => r.data),
}

export const reportsApi = {
  getStatus: () => api.get('/reports').then(r => r.data),
  markSubmitted: (id, date) => api.put(`/reports/${id}`, { date }).then(r => r.data),
  markBulk: (ids, date) => api.put('/reports/bulk/submit', { ids, date }).then(r => r.data),
}

export const exportApi = {
  // Gibt bewusst die volle Axios-Response zurück (nicht nur .data), damit der
  // Aufrufer den Dateinamen aus dem Content-Disposition-Header lesen kann.
  reportsExcel: (params) => api.get('/export/reports.xlsx', { params, responseType: 'blob' }),
  reportsPdf: (azubiId, params) => api.get(`/export/reports/${azubiId}/pdf`, { params, responseType: 'blob' }),
}

export const settingsApi = {
  getAll: () => api.get('/settings').then(r => r.data),
  update: (key, value) => api.put(`/settings/${key}`, { value }).then(r => r.data),
}

export const workflowsApi = {
  getAll: () => api.get('/workflows').then(r => r.data),
  create: (data) => api.post('/workflows', data).then(r => r.data),
  update: (id, data) => api.put(`/workflows/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/workflows/${id}`).then(r => r.data),
  getRuns: (id) => api.get(`/workflows/${id}/runs`).then(r => r.data),
}

export const pushApi = {
  getVapidPublicKey: () => api.get('/push/vapid-public-key').then(r => r.data),
  subscribe: (subscription) => api.post('/push/subscribe', subscription).then(r => r.data),
  unsubscribe: (endpoint) => api.delete('/push/subscribe', { data: { endpoint } }).then(r => r.data),
}
