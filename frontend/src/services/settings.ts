import api from './api';

export type DashboardSettings = {
  selectedIntegrations: string[]; // keys like 'jenkins:<id>' | 'github:<id>'
  updatedAt?: string;
};

export async function getDashboardSettings(): Promise<DashboardSettings> {
  const res = await api.get('/settings/dashboard');
  return res.data.data || res.data;
}

export async function updateDashboardSettings(payload: DashboardSettings): Promise<DashboardSettings> {
  const res = await api.put('/settings/dashboard', payload);
  return res.data.data || res.data;
}
