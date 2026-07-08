const BASE_URL = 'http://localhost:8000/api';

const getHeaders = () => {
  const token = sessionStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  async get(path) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'API request failed');
    }
    return res.json();
  },

  async upload(path, file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(), // Do NOT specify content-type, browser does it with boundaries
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },
  
  getExportUrl(datasetId, format = 'csv') {
    const token = sessionStorage.getItem('token');
    return `${BASE_URL}/datasets/${datasetId}/export?format=${format}&token=${token}`;
  }
};
