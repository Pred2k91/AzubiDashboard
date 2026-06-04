import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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
  create: (data) => api.post('/azubis', data).then(r => r.data),
  update: (id, data) => api.put(`/azubis/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/azubis/${id}`).then(r => r.data),
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

export const settingsApi = {
  getAll: () => api.get('/settings').then(r => r.data),
  update: (key, value) => api.put(`/settings/${key}`, { value }).then(r => r.data),
}
