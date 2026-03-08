import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  // In development, use CRA proxy when REACT_APP_API_URL is not provided.
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const apiService = {
  // Health check
  health: () => api.get('/api/health'),
  
  // VMs
  getVMs: () => api.get('/api/vms'),
  getVM: (id) => api.get(`/api/vms/${id}`),
  createVM: (data) => api.post('/api/vms', data),
  updateVM: (id, data) => api.put(`/api/vms/${id}`, data),
  deleteVM: (id) => api.delete(`/api/vms/${id}`),
  startVM: (id) => api.post(`/api/vms/${id}/start`),
  stopVM: (id) => api.post(`/api/vms/${id}/stop`),
  restartVM: (id) => api.post(`/api/vms/${id}/restart`),
  getVMMetrics: (id, limit = 60) => api.get(`/api/vms/${id}/metrics?limit=${limit}`),
  
  // Images
  getImages: () => api.get('/api/images/', { params: { _: Date.now() } }),
  uploadImage: (formData, onUploadProgress) => api.post('/api/images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  }),
  uploadImageByURL: (url) => api.post('/api/images/upload-url', { url }),
  importImagesFromDirectory: (path) => api.post('/api/images/import-directory', { path }),
  deleteImage: (id) => api.delete(`/api/images/${id}`),
  
  // Servers
  getServers: () => api.get('/api/servers'),
  getServer: (id) => api.get(`/api/servers/${id}`),
  addServer: (data) => api.post('/api/servers', data),
  updateServer: (id, data) => api.put(`/api/servers/${id}`, data),
  deleteServer: (id) => api.delete(`/api/servers/${id}`),
  getServerMetrics: (id) => api.get(`/api/servers/${id}/metrics`),
  
  // Clusters
  getClusters: () => api.get('/api/clusters'),
  getCluster: (id) => api.get(`/api/clusters/${id}`),
  createCluster: (data) => api.post('/api/clusters', data),
  updateCluster: (id, data) => api.put(`/api/clusters/${id}`, data),
  deleteCluster: (id) => api.delete(`/api/clusters/${id}`),
  addHostToCluster: (clusterId, hostData) => api.post(`/api/clusters/${clusterId}/hosts`, hostData),
  removeHostFromCluster: (clusterId, hostId) => api.delete(`/api/clusters/${clusterId}/hosts/${hostId}`),

  // Networks
  getNetworks: () => api.get('/api/networks'),
  createNetwork: (data) => api.post('/api/networks', data),

  // Storage
  getStorage: () => api.get('/api/storage'),
  createStorageVolume: (data) => api.post('/api/storage/volumes', data),
  
  // Snapshots
  getSnapshots: (vmId) => api.get(`/api/vms/${vmId}/snapshots`),
  createSnapshot: (vmId, data) => api.post(`/api/vms/${vmId}/snapshots`, data),
  deleteSnapshot: (snapshotId) => api.delete(`/api/snapshots/${snapshotId}`),
  restoreSnapshot: (snapshotId) => api.post(`/api/snapshots/${snapshotId}/restore`),
};

export default api;