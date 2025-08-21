import api from './api';

export interface JenkinsConfig {
  id: string;
  name: string;
  baseUrl: string;
  username?: string | null;
  password?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listJenkinsConfigs(): Promise<JenkinsConfig[]> {
  const { data } = await api.get('/integrations/jenkins-configs');
  return data.data;
}

export async function getJenkinsConfig(id: string): Promise<JenkinsConfig> {
  const { data } = await api.get(`/integrations/jenkins-configs/${id}`);
  return data.data;
}

export async function createJenkinsConfig(payload: Partial<JenkinsConfig> & { name: string; baseUrl: string; active?: boolean }): Promise<JenkinsConfig> {
  const { data } = await api.post('/integrations/jenkins-configs', payload);
  return data.data;
}

export async function updateJenkinsConfig(id: string, payload: Partial<JenkinsConfig>): Promise<JenkinsConfig> {
  const { data } = await api.patch(`/integrations/jenkins-configs/${id}`, payload);
  return data.data;
}

export async function deleteJenkinsConfig(id: string): Promise<void> {
  await api.delete(`/integrations/jenkins-configs/${id}`);
}

export async function fetchJenkinsOverview(providerId: string) {
  const { data } = await api.get(`/integrations/jenkins/overview`, { params: { providerId } });
  return data.data as { jobs: { name: string; url: string; color?: string }[]; lastBuilds: any[] };
}
