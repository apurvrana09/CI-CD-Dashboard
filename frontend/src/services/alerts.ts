import api from './api';

export type AlertType = 'BUILD_FAILURE' | 'DEPLOYMENT_FAILURE' | 'PERFORMANCE_DEGRADATION' | 'SECURITY_ISSUE' | 'CUSTOM';

export interface Alert {
  id: string;
  name: string;
  type: AlertType;
  conditions: any;
  channels: any;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function listAlerts(params?: { page?: number; limit?: number; type?: AlertType; isActive?: boolean }) {
  const { data } = await api.get('/alerts', { params });
  return data;
}

export async function createAlert(payload: { name: string; type: AlertType; conditions: any; channels: any }) {
  const { data } = await api.post('/alerts', payload);
  return data;
}

export async function updateAlert(id: string, payload: Partial<Alert>) {
  const { data } = await api.put(`/alerts/${id}`, payload);
  return data;
}

export async function deleteAlert(id: string) {
  const { data } = await api.delete(`/alerts/${id}`);
  return data;
}

export async function testAlert(payload: { channels?: any; title?: string; text?: string }) {
  const { data } = await api.post('/alerts/test', payload);
  return data;
}
